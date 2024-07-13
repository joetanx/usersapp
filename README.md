## 1. Node.js Express User Authenication App

The [app.js](/app.js) is an example Node.js application on user authentication service using the Express framework.

It includes routes for login, registration and userinfo both for browser-based interactions and API endpoints.

### 1.1. Dependencies

|Module|Description|
|---|---|
|`express`|Framework for building web applications and APIs.|
|`bcrypt`|Library for hashing passwords.|
|`dotenv`|Loads environment variables from a `.env` file into `process.env`.|
|`jsonwebtoken`|Implements JSON Web Token (JWT) creation and verification.|
|`mysql2`|MySQL database client.|
|`pg`|PostgreSQL database client.|
|`cookie-parser`|Middleware to parse cookies in incoming requests.|

### 1.2. Environment Variables

The app retrieves configuration variables like database credentials, JWT keys and other settings from environment variables.

The environment variables are sourced from `.env` file or container `env` for Podman/Kubernetes.

### 1.3. Database Connection

The app is coded to work with both MySQL and PostgreSQL databases.

The [MySQL](users-my.sql) and [PostgreSQL](users-pg.sql) database files in this repository provide fictitious generated data as initial user pool to test the application.

Database type is selected by the `DB_TYPE` environment variable: `mysql` or `pgsql`.

> [!Note]
>
> There is extensive use of ternary operators in the code to select between MySQL and PostgreSQL functions and queries based on the `DB_TYPE` parameter.
>
> For reference, ternary operator syntax is: `condition ? exprIfTrue : exprIfFalse`.
>
> Examples:
>
> ```js
> const getUserQuery = (dbType == 'pgsql') ? `SELECT * FROM users WHERE email = $1` : `SELECT * FROM users WHERE email = ?`
> ```
>
> ```js
> await (dbType == 'pgsql') ? client.query(insertUserQuery, <parameters>) : client.promise().execute(insertUserQuery, <parameters>)
> ```

> [!Note]
>
> MySQL and PostgreSQL handles case sensitivity differently on the queries.
>
> Columns `firstName` and `lastName` are case sensitive in MySQL, while PostgreSQL automatically lower-case the parameters unless it's enclosed with double quotes `""`.
>
> This is the reason for the `firstName: user.firstname || user.firstName` and `lastName: user.lastname || user.lastName` lines in `/home` and `/userinfo` routes.

### 1.4. User Session and Security

#### Password hashing

Password hashing is done by `bcrypt` with 12 iterations.

#### Authentication and cookie-based sessions

JWTs are signed and verified by the with [lab_issuer](https://github.com/joetanx/lab-certs/blob/main/ca/lab_issuer.pem) key pair using `ES384` algorithm.

JWTs are verified from cookies for browser-based access and from `Authorization: <jwt>` header for API-based access.

### 1.5. Middleware Setup

The express server listens on port `3000` with the configurations below:

|Function|Description
|---|---|
|Body Parsing|Parses incoming JSON and `x-www-form-urlencoded` request bodies.|
|Cookie Parsing|Parses cookies attached to incoming requests.|
|Static Files|Serves static files from the `static` directory.|
|View Engine|Uses Handlebars (`hbs`) as the view engine, rendering templates from the `views` directory.|

### 1.6. Functions

**`queryUser(email)`**
- **Purpose**: Retrieves user information based on email.
- **Parameters**: `email` - Email of the user to retrieve.
- **Returns**: User data object fetched from the database.

**`insertUser(params)`**
- **Purpose**: Inserts a new user into the database.
- **Parameters**: `params` - Object containing user details (`firstName`, `lastName`, `username`, `email`, `mobile`, `password`).
- **Returns**: None.

**`generateToken(email)`**
- **Purpose**: Generates a JWT token for the given email.
- **Parameters**: `email` - Email of the user.
- **Returns**: JWT token string.

**`verifyToken(token)`**
- **Purpose**: Verifies the authenticity of a JWT token.
- **Parameters**: `token` - JWT token to verify.
- **Returns**: Decoded payload if the token is valid; otherwise, throws an error.

### 1.7. Routes

#### 1.7.1. Browser Access

**`GET /`**

Renders the index/intro page.

**`GET /login`**

Renders the login page.

**`GET /register`**

Renders the registration page.

**`POST /auth/login`**
- **Purpose**: Handles user login from browser.
- **Parameters**: `email`, `password` - Credentials submitted in the request body.
- **Returns**: Redirects to `/home` on successful login; renders error `message` on failure.

**`POST /auth/register`**
- **Purpose**: Handles user registration from browser.
- **Parameters**: User details (`firstName`, `lastName`, `username`, `email`, `mobile`, `password`) submitted in the request body.
- **Returns**: Renders success `message` upon successful registration; renders error `message` on failure.

**`GET /home`**
- **Purpose**: User home page.
- **Parameters**: Requires a valid JWT token stored in cookies.
- **Returns**: Renders `home` with user details on success; renders error `message` on failure.

#### 1.7.2. API Access

**`POST /api/login`**
- **Purpose**: Handles user login via API.
- **Parameters**: `email`, `password` - Credentials submitted in the request body.
- **Returns**: JSON response with authentication status and JWT token on success; error message on failure.

**`GET /api/userinfo`**
- **Purpose**: Retrieves user information via API.
- **Parameters**: JWT token in the `Authorization` header.
- **Returns**: JSON response with user details on success; error message on failure.

### 1.8. Deployment

This guide walks through 3 methods to deploy the users app:
- [Kubernetes](#2-deployment-on-kubernetes)
- [Podman](#3-deployment-on-podman)
- [Manual install](#4-deployment-via-manual-install)

> [!Warning]
>
> The deployment configurations are insecure (e.g. embedding passwords and keys using environment variables and ConfigMaps)
>
> Perform appropriate secure edits if adapting to production environment

## 2. Deployment on Kubernetes

### 2.1. Kubernetes manifest

The [`usersapp.yaml`](/usersapp.yaml) in this repository defines services, deployments, and an ingress for the app within the `usersapp` namespace.

#### 2.1.1. Services

|Name|Type|Port|Selectors|
|---|---|---|---|
|mysql|ClusterIP|3306|`app: mysql`|
|pgsql|ClusterIP|5432|`app: pgsql`|
|node|ClusterIP|3000|`app: node`|

> [!note]
>
> Kubernetes services are accessible within the cluster on `<service-name>.<namespace>.svc.cluster.local`
>
> e.g. `mysql.usersapp.svc.cluster.local`, `pgsql.usersapp.svc.cluster.local`, `node.usersapp.svc.cluster.local`

#### 2.1.2. Deployments

**mysql**

- Pods label: `app: mysql`
- Runs MySQL database (`docker.io/library/mysql:latest`)
- Configured with environment variables for database setup (`MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`)
- Mounts a ConfigMap (`db-mysql`) on `/docker-entrypoint-initdb.d` for database initialization script

**pgsql**

- Pods label: `app: pgsql`
- Runs MySQL database (`docker.io/library/postgres:latest`)
- Configured with environment variables for database setup (`POSTGRES_PASSWORD`)
- Mounts a ConfigMap (`db-mysql`) on `/docker-entrypoint-initdb.d` for database initialization script

> [!Note]
>
> Unlike the `mysql` container image, the `postgres` container image does not expose environment variable to creates additional database users
>
> User creation lines will be added to the database initialization script in the preparation steps below to create the `node` database user

**node**

- Runs Node.js application (`docker.io/library/node:latest`)
- Installs required npm packages and starts the application (`npm install ... && node app.js`)
- Configured with environment variables for database connection (`DB_TYPE`, `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`), JWT keys (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`)
- Mounts ConfigMaps for application code (`node-app`), SSL certificates (`node-pki`), and view templates (`node-views`)

#### 2.1.3. Ingress

- **Name**: usersapp
- **Annotations**: Uses `cert-manager.io/cluster-issuer: ca-issuer` for SSL certificates
- **TLS**: Enables HTTPS with a TLS secret (`usersapp-tls`)
- **Routing**: Directs traffic from `usersapp.vx` to the Node.js service (`node`) on path `/`

### 2.2. Deployment

Create namespace:

```sh
kubectl create namespace usersapp
```

Download database scripts:

```sh
curl -sLO https://github.com/joetanx/usersapp/raw/main/users-my.sql
curl -sLO https://github.com/joetanx/usersapp/raw/main/users-pg.sql
```

Add Postgres user creation to `users-pg.sql`:

```sh
cat << EOF >> users-pg.sql
CREATE ROLE node WITH LOGIN PASSWORD 'password';
GRANT ALL ON users TO node;
GRANT USAGE ON SEQUENCE users_id_seq TO node;
EOF
```

Create ConfigMap for mysql and pgsql:

```sh
kubectl -n usersapp create configmap db-mysql --from-file=users-my.sql
kubectl -n usersapp create configmap db-pgsql --from-file=users-pg.sql
```

Download keys, application code and view templates:

```sh
curl -sLo jwt.key https://github.com/joetanx/lab-certs/raw/main/ca/lab_issuer.key
curl -sLo jwt.pem https://github.com/joetanx/lab-certs/raw/main/ca/lab_issuer.pem
curl -sLO https://github.com/joetanx/usersapp/raw/main/app.js
curl -sLo index.hbs https://github.com/joetanx/usersapp/raw/main/index.html
curl -sLo login.hbs https://github.com/joetanx/usersapp/raw/main/login.html
curl -sLo register.hbs https://github.com/joetanx/usersapp/raw/main/register.html
curl -sLo home.hbs https://github.com/joetanx/usersapp/raw/main/home.html
curl -sLo message.hbs https://github.com/joetanx/usersapp/raw/main/message.html
```

Create ConfigMap for node:

```sh
kubectl -n usersapp create configmap node-pki --from-file=jwt.key --from-file=jwt.pem
kubectl -n usersapp create configmap node-app --from-file=app.js
kubectl -n usersapp create configmap node-views --from-file=index.hbs --from-file=login.hbs --from-file=register.hbs --from-file=home.hbs --from-file=message.hbs
```

Deploy:

```sh
kubectl create -f https://github.com/joetanx/usersapp/raw/main/usersapp.yaml
```

Optional - clean up files: `rm -f *.sql jwt.* app.js *.hbs`

## 3. Deployment on Podman

## 4. Deployment via manual install

## 4. Database Setup

### 4.1. MySQL

#### 4.1.1. Install

```
yum -y install mysql-server
systemctl enable --now mysqld
firewall-cmd --add-service mysql --permanent && firewall-cmd --reload
```

#### 4.1.2. Populate database

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

#### 4.1.3. Setup user

```
mysql -u root -e "CREATE USER 'node'@'%' IDENTIFIED BY 'password';"
mysql -u root -e "GRANT ALL PRIVILEGES ON users.* TO 'node'@'%';"
rm -f /root/.mysql_history
```

### 4.2. PostgreSQL

#### 4.2.1. Install

```
yum -y install postgresql-server postgresql-contrib
postgresql-setup --initdb
systemctl enable --now postgresql
firewall-cmd --add-service postgresql --permanent && firewall-cmd --reload
```

#### 4.2.2. Populate database

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

#### 4.2.3. Configure authentication

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

#### 4.2.4. Setup user

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
