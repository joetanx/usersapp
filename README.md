## 1. Setup

### 1.1. MySQL

#### 1.1.1. Install

```
yum -y install mysql-server
systemctl enable --now mysqld
firewall-cmd --add-service mysql --permanent && firewall-cmd --reload
```

#### 1.1.2. Populate database

```
curl -sLo /tmp/users-my.sql https://github.com/joetanx/users-app/raw/main/users-my.sql
mysql -u root < /tmp/users-my.sql
rm -f /tmp/users-my.sql
```

Test query - retrieve a row randomly:

```
mysql -u root -e "SELECT id,firstName,lastName,username,email,mobile,password FROM users.users ORDER BY RAND() LIMIT 0,1;"
```

Test query - search for a user:

```
mysql -u root -e "SELECT id,firstName,lastName,username,email,mobile,password FROM users.users WHERE firstName LIKE '%jack%';"
```

#### 1.1.3. Setup user

```
mysql -u root -e "CREATE USER 'node'@'%' IDENTIFIED BY 'password';"
mysql -u root -e "GRANT ALL PRIVILEGES ON users.* TO 'node'@'%';"
rm -f /root/.mysql_history
```

### 1.2. PostgreSQL

#### 1.2.1. Install

```
yum -y install postgresql-server postgresql-contrib
postgresql-setup --initdb
systemctl enable --now postgresql
firewall-cmd --add-service postgresql --permanent && firewall-cmd --reload
```

#### 1.2.2. Populate database

```
cd /var/lib/pgsql
curl -sLo /tmp/users-pg.sql https://github.com/joetanx/users-app/raw/main/users-pg.sql
sudo -u postgres psql -d postgres -f /tmp/users-pg.sql
rm -f /tmp/users-pg.sql
cd ~
```

Test query - retrieve a row randomly:

```
sudo -u postgres psql -d users -c "SELECT id,firstName,lastName,username,email,mobile,password FROM users ORDER BY RANDOM() LIMIT 1 OFFSET 0;"
```

Test query - search for a user:

```
sudo -u postgres psql -d users -c "SELECT id,firstName,lastName,username,email,mobile,password FROM users WHERE LOWER(firstName) LIKE '%jack%';"
```

<details><summary>Manually create database, table and insert data</summary>

```
echo "SELECT 'CREATE DATABASE users' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'users')\gexec" | sudo -u postgres psql -d postgres
sudo -u postgres psql -d users -c "
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  firstName VARCHAR(128) NOT NULL DEFAULT '',
  lastName VARCHAR(128) NOT NULL DEFAULT '',
  email VARCHAR(128) NOT NULL DEFAULT '',
  mobile VARCHAR(128) NOT NULL DEFAULT ''
);"
sudo -u postgres psql -d users -c "INSERT INTO users VALUES (DEFAULT,'Liam','Johnson','liam.johnson','liam.johnson@example.com','+6584582486','$2b$12$BH7SkO8BNUFdYpOU60INqutF79m0g6W9Sonzkit2e2poyADGGVJiO');"
⋮
```

</details>

#### 1.2.3. Configure authentication

Configure `/var/lib/pgsql/data/pg_hba.conf` to use password authentication over `scram-sha-256` hashing

```
⋮
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             all                                     peer
# IPv4 local connections:
host    all             all             0.0.0.0/0               scram-sha-256
# IPv6 local connections:
host    all             all             ::1/128                 ident
# Allow replication connections from localhost, by a user with the
# replication privilege.
local   replication     all                                     peer
⋮
```

Configure `/var/lib/pgsql/data/postgresql.conf` to listen on all addresses and enable `scram-sha-256` hashing

```
⋮
#------------------------------------------------------------------------------
# CONNECTIONS AND AUTHENTICATION
#------------------------------------------------------------------------------

# - Connection Settings -

listen_addresses = '0.0.0.0'            # what IP address(es) to listen on;
                                        # comma-separated list of addresses;
                                        # defaults to 'localhost'; use '*' for all
                                        # (change requires restart)
#port = 5432                            # (change requires restart)
max_connections = 100                   # (change requires restart)
⋮
# - Authentication -
⋮
password_encryption = scram-sha-256
⋮
```

Restart PostgreSQL

```
systemctl restart postgresql
```

#### 1.2.4. Setup user

```
cd /var/lib/pgsql
sudo -u postgres psql -c "CREATE ROLE node WITH LOGIN PASSWORD 'password';"
sudo -u postgres psql -d users -c "GRANT ALL ON users TO node;"
sudo -u postgres psql -d users -c "GRANT USAGE ON SEQUENCE users_id_seq TO node;"
rm -f /var/lib/pgsql/.psql_history /root/.psql_history
cd ~
```

Resetting user password (if needed)

```
sudo -u postgres psql -c "ALTER USER node WITH PASSWORD 'password';"
```
