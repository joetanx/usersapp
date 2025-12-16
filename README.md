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

The [users](users.md) data is split into `auth` and `data` tables, with `guid` as the key to join user data across the tables

The [MySQL](users.auth.my.sql) and [PostgreSQL](users.data.pg.sql) database files in this repository provide fictitious generated data as initial user pool to test the application

> [!Tip]
>
> Columns are case sensitive in MySQL, while PostgreSQL automatically lower-case them unless they're enclosed with double quotes `""`
>
> Hence, `firstname` and `lastname` in `insertUserData` query can be lower case when column names are `firstName` and `lastName`
>
> If similar case columns exist in MySQL, the query must follow the cases of the columns
>
> Ternary operators (`condition ? exprIfTrue : exprIfFalse`) can be helpful to select the appropriate names
>
> For example, if column `thisColumn` exists in both MySQL and PostgreSQL tables and variable `dbType` specifies the database:
>
> ```
> const columnName = (dbType == 'pgsql') ? `thiscolumn` : `thisColumn`
> ```

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

#### `userCheck(email)`
- **Purpose**: Runs `getUserAuthByEmail` query to lookup for user in `auth` email
- **Parameters**: `email` - email of the user to retrieve
- **Returns**: User auth row (`guid`, `email` and `password`) retrieved from the table

#### `userDetails(guid)`
- **Purpose**: Runs `getUserAuthByGuid` and `getUserDataByGuid` queries to lookup for user in `auth` and `data` by guid
- **Parameters**: `guid` - guid of the user to retrieve
- **Returns**: User data object (`guid`, `firstName`, `lastName`, `username`, `email` and `mobile`) synthesized from data retrieved from the tables

#### `userReg(params)`
- **Purpose**: Generates hashed password and guid, then runs  `insertUserAuth` and `insertUserData` to insert a new user into `auth` and `data`
- **Parameters**: `params` - Object containing user details (`firstName`, `lastName`, `username`, `email`, `mobile`, `password`)
- **Returns**: None.

> [!Important]
>
> Atomicity is not implemented, meaning if a row is inserted into `auth`, but fails for `data`, there will be a "dirty" row in `auth` that does not correspond to a row in `data`

#### `generateToken(guid)`
- **Purpose**: Generates a JWT token for the user's guid
- **Parameters**: `guid` - Email of the user
- **Returns**: JWT token string

#### `verifyToken(token)`
- **Purpose**: Verifies the authenticity of a JWT token
- **Parameters**: `token` - JWT token to verify
- **Returns**: Decoded payload if the token is valid; otherwise, throws an error

### 1.7. Routes

#### 1.7.1. Browser Access

##### 1.7.1.1. `GET` `/`

Renders the index/intro page

![](https://github.com/user-attachments/assets/09e0672d-0f8a-4a36-85d9-35042fb09532)

##### 1.7.1.2. `GET` `/login`

Renders the login page
- The `Login` button is disabled until both email address and password are filled in
- The `Email address` field checks for proper email format input

![](https://github.com/user-attachments/assets/d4c4c09c-78c5-4085-8335-8ac17d71a855)

##### 1.7.1.3. `GET` `/register`

Renders the registration page.
- The `Sign up` button is disabled unless:
  - All fields are filled in
  - Input to the `Password` and `Confirm Password` fields are identical
- The `Confirm Password` field warns when it is different from the `Password` field

![](https://github.com/user-attachments/assets/008b8b3c-8a0c-4c39-b248-d6123bd7d190)

##### 1.7.1.4. `POST` `/auth/login`

- **Purpose**: Handles user login from browser.
- **Parameters**: `email`, `password` - Credentials submitted in the request body.
- **Returns**: Redirects to `/home` on successful login; renders error `message` on failure.

Error for empty or non-existent email address:

![](https://github.com/user-attachments/assets/7e152e00-0993-4237-8a2d-1b87754acb0f)

Error for incorrect password entered:

![](https://github.com/user-attachments/assets/9a534576-c8f5-4fdb-9a84-2d38945d5586)

> [!Note]
>
> Authentication error would likely be a generic `invalid email or password` in actual services
>
> This example app intentionally display different outputs between email and password error for easy debugging

##### 1.7.1.5. `POST` `/auth/register`

- **Purpose**: Handles user registration from browser.
- **Parameters**: User details (`firstName`, `lastName`, `username`, `email`, `mobile`, `password`) submitted in the request body.
- **Returns**: Renders success `message` upon successful registration; renders error `message` on failure.

Successful registration:

![](https://github.com/user-attachments/assets/d694b43d-168d-4acc-9606-d18a39f23c7e)

Error if email address already exists:

![](https://github.com/user-attachments/assets/48a13db9-b804-4762-9040-e17a337cc726)

##### 1.7.1.6. `GET` `/home`

- **Purpose**: User home page.
- **Parameters**: Requires a valid JWT token stored in cookies.
- **Returns**: Renders `home` with user details on success; renders error `message` on failure.

Error message when loading `/home` without authentication (non-existent, expired or invalid JWT in cookies):

![](https://github.com/user-attachments/assets/bfa2acdc-421d-4f25-b4be-54e5899ded04)

Loading `/home` with valid JWT:

![](https://github.com/user-attachments/assets/896daeef-c31a-41d0-8e0a-8c0a95c92dc3)

#### 1.7.2. API Access

##### 1.7.2.1. `POST` `/api/login`

- **Purpose**: Handles user login via API.
- **Parameters**: `email`, `password` - Credentials submitted in the request body.
- **Returns**: JSON response with authentication status and JWT token on success; error message on failure.

Login with empty or invalid email:

```console
[root@delta ~]# curl -s -H 'Content-Type: application/json' -X POST -d '{"email":"","password":"ryan.ward"}' https://usersapp.vx/api/login | jq
{
  "error": "User not found"
}
[root@delta ~]# curl -s -H 'Content-Type: application/json' -X POST -d '{"email":"ryan.ward@invalid.com","password":"ryan.ward"}' https://usersapp.vx/api/login | jq
{
  "error": "User not found"
}
```

Login with missing parameters:

```console
[root@delta ~]# curl -s -H 'Content-Type: application/json' -X POST -d '{"email":"ryan.ward@example.com"}' https://usersapp.vx/api/login | jq
{
  "error": "Internal server error"
}
[root@delta ~]# curl -s -H 'Content-Type: application/json' -X POST -d '{"password":"ryan.ward"}' https://usersapp.vx/api/login | jq
{
  "error": "Internal server error"
}
[root@delta ~]# curl -s -H 'Content-Type: application/json' -X POST -d '{}' https://usersapp.vx/api/login | jq
{
  "error": "Internal server error"
}
```

Login with incorrect password:

```console
[root@delta ~]# curl -s -H 'Content-Type: application/json' -X POST -d '{"email":"ryan.ward@example.com","password":"wrong.password"}' https://usersapp.vx/api/login | jq
{
  "error": "Incorrect password"
}
```

Successful Logins:

```console
[root@delta ~]# curl -s -H 'Content-Type: application/json' -X POST -d '{"email":"ryan.ward@example.com","password":"ryan.ward"}' https://usersapp.vx/api/login | jq
{
  "authentication": "Successful",
  "authorization": "eyJhbGciOiJFUzM4NCIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InJ5YW4ud2FyZEBleGFtcGxlLmNvbSIsImlhdCI6MTcyMDkzOTY5MCwiZXhwIjoxNzIwOTQwMTcwfQ.iNacYpM4Ci_ykUXx3OKO4Gj3afHDLxpxoRSIK3JukbobZ1mzlJVGtMTLL9AEhc2J59_X170I0whIy13R3mnzW2QROgBiGJHZVEMjXrI5C6lq46P9TWFzwKEc-eE9ZRaB",
  "message": "Welcome, ryan.ward"
}
[root@delta ~]# curl -s -H 'Content-Type: application/x-www-form-urlencoded' -X POST -d 'email=ryan.ward%40example.com&password=ryan.ward' https://usersapp.vx/api/login | jq
{
  "authentication": "Successful",
  "authorization": "eyJhbGciOiJFUzM4NCIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InJ5YW4ud2FyZEBleGFtcGxlLmNvbSIsImlhdCI6MTcyMDkzOTc1MSwiZXhwIjoxNzIwOTQwMjMxfQ.ZDIaqFmNxTNI4kJVbOG6OosgXfAaVAJni403FF0mAO3UwcgqnDkoNqd2YpNw1nxAv9_1o9r39r_wWaHU13dCza6b8IVvQEqPjWn9tQClP2lpJn35fP3Q94RVjh_v-tds",
  "message": "Welcome, ryan.ward"
}
```

##### 1.7.2.2. `GET` `/api/userinfo`

- **Purpose**: Retrieves user information via API.
- **Parameters**: JWT token in the `Authorization` header.
- **Returns**: JSON response with user details on success; error message on failure.

Retrieval without authorization:

```console
[root@delta ~]# curl -s https://usersapp.vx/api/userinfo | jq
{
  "error": "Unauthorized"
}
```

Successful retrieval:

```console
[root@delta ~]# curl -s -H "Authorization: $jwt" https://usersapp.vx/api/userinfo | jq
{
  "id": 47,
  "firstName": "Ryan",
  "lastName": "Ward",
  "username": "ryan.ward",
  "email": "ryan.ward@example.com",
  "mobile": "+6597029602"
}
```

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
|mysql|ClusterIP|3306|`app.kubernetes.io/component: mysql`|
|pgsql|ClusterIP|5432|`app.kubernetes.io/component: pgsql`|
|node|ClusterIP|3000|`app.kubernetes.io/component: node`|

> [!note]
>
> Kubernetes services are accessible within the cluster on `<service-name>.<namespace>.svc.cluster.local`
>
> e.g. `mysql.usersapp.svc.cluster.local`, `pgsql.usersapp.svc.cluster.local`, `node.usersapp.svc.cluster.local`

#### 2.1.2. Deployments

**mysql**

- Pods label: `app.kubernetes.io/component: mysql`
- Runs MySQL database (`docker.io/library/mysql:latest`)
- Configured with environment variables for database setup (`MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`)
- Mounts a ConfigMap (`db-mysql`) on `/docker-entrypoint-initdb.d` for database initialization script

**pgsql**

- Pods label: `app.kubernetes.io/component: pgsql`
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
- Configured with environment variables for database connection (`MY_HOST`, `MY_DB`, `MY_USER`, `MY_PASSWORD`, `PG_HOST`, `PG_DB`, `PG_USER`, `PG_PASSWORD`), JWT keys (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`)
- Mounts ConfigMaps for application code (`node-app`), SSL certificates (`node-pki`), and view templates (`node-views`)

#### 2.1.3. IngressRoute and certificate

- Routing: Traefik IngressRoute directs traffic from `usersapp.vx` to the Node.js service (`node`) on path `/`
- TLS: `Certificate` resource named `usersapp` managed by `cert-manager`, private key in secret `usersapp` linked to IngressRoute

### 2.2. Deployment

Create namespace:

```sh
kubectl create namespace usersapp
```

Download database scripts:

```sh
curl -sLO https://github.com/joetanx/usersapp/raw/main/users.auth.my.sql
curl -sLO https://github.com/joetanx/usersapp/raw/main/users.data.pg.sql
```

Add Postgres user creation to `users.data.pg.sql`:

```sh
cat << EOF >> users.data.pg.sql
CREATE ROLE node WITH LOGIN PASSWORD 'password';
GRANT ALL ON data TO node;
EOF
```

Create ConfigMap for mysql and pgsql:

```sh
kubectl -n usersapp create configmap db-mysql --from-file=users.auth.my.sql
kubectl -n usersapp create configmap db-pgsql --from-file=users.data.pg.sql
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

### 3.1. Preparation

Install necessary packages and configure firewall rules:

```sh
yum -y install podman jq
firewall-cmd --permanent --add-service mysql && \
firewall-cmd --permanent --add-service postgresql && \
firewall-cmd --permanent --add-port 3000/tcp && \
firewall-cmd --permanent --add-service https && \
firewall-cmd --reload
```

### 3.2. Deploy MySQL and PostgreSQL

Download database scripts:

```sh
mkdir /etc/usersapp
curl -sLo /etc/usersapp/users.auth.my.sql https://github.com/joetanx/usersapp/raw/main/users.auth.my.sql
curl -sLo /etc/usersapp/users.data.pg.sql https://github.com/joetanx/usersapp/raw/main/users.data.pg.sql
```

Add Postgres user creation to `users.data.pg.sql`:

> [!Note]
>
> Unlike the `mysql` container image, the `postgres` container image does not expose environment variable to creates additional database users
>
> User creation lines are added to the database initialization script create the `node` database user

```sh
cat << EOF >> /etc/usersapp/users.data.pg.sql
CREATE ROLE node WITH LOGIN PASSWORD 'password';
GRANT ALL ON data TO node;
EOF
```

Deploy MySQL and PostgreSQL containers with initial setup scripts:

```sh
# MySQL deployment
podman run -d -p 3306:3306 \
-v /etc/usersapp/users.auth.my.sql:/docker-entrypoint-initdb.d/users.auth.my.sql \
-e MYSQL_DATABASE=users \
-e MYSQL_USER=node \
-e MYSQL_PASSWORD=password \
-e MYSQL_ROOT_PASSWORD=rootpassword \
--name mysql docker.io/library/mysql:latest

# PostgreSQL deployment
podman run -d -p 5432:5432 \
-v /etc/usersapp/users.data.pg.sql:/docker-entrypoint-initdb.d/users.data.pg.sql \
-e POSTGRES_PASSWORD=postgrespassword \
--name postgres docker.io/library/postgres:latest
```

### 3.3. Deploy Node.js Application

Download keys, application code and view templates:

```sh
mkdir /etc/usersapp/views /etc/usersapp/pki
curl -sLo /etc/usersapp/pki/jwt.key https://github.com/joetanx/lab-certs/raw/main/ca/lab_issuer.key
curl -sLo /etc/usersapp/pki/jwt.pem https://github.com/joetanx/lab-certs/raw/main/ca/lab_issuer.pem
curl -sLo /etc/usersapp/app.js https://github.com/joetanx/usersapp/raw/main/app.js
curl -sLo /etc/usersapp/views/index.hbs https://github.com/joetanx/usersapp/raw/main/index.html
curl -sLo /etc/usersapp/views/login.hbs https://github.com/joetanx/usersapp/raw/main/login.html
curl -sLo /etc/usersapp/views/register.hbs https://github.com/joetanx/usersapp/raw/main/register.html
curl -sLo /etc/usersapp/views/home.hbs https://github.com/joetanx/usersapp/raw/main/home.html
curl -sLo /etc/usersapp/views/message.hbs https://github.com/joetanx/usersapp/raw/main/message.html
```

Deploy the Node.js application container:

```sh
podman run -d -p 3000:3000 \
-v /etc/usersapp:/etc/usersapp:Z \
-e MY_HOST=$(hostname) \
-e MY_DB='users' \
-e MY_USER='node' \
-e MY_PASSWORD='password' \
-e PG_HOST=$(hostname) \
-e PG_DB='users' \
-e PG_USER='node' \
-e PG_PASSWORD='password' \
-e JWT_PRIVATE_KEY='/etc/usersapp/pki/jwt.key' \
-e JWT_PUBLIC_KEY='/etc/usersapp/pki/jwt.pem' \
-w /etc/usersapp \
--name node node:latest /bin/bash -c "npm install express express-session mysql2 pg path dotenv bcrypt hbs jsonwebtoken cookie-parser && node app.js"
```

### 3.4. Deploy Nginx

Nginx container is used for reverse proxy and SSL termination.

Download certificates and Nginx config file:

```sh
mkdir -p /etc/nginx/tls
curl -sLo /etc/nginx/tls/server.pem https://github.com/joetanx/lab-certs/raw/main/others/$(hostname).pem
curl -sLo /etc/nginx/tls/server.key https://github.com/joetanx/lab-certs/raw/main/others/$(hostname).key
curl -sLo /etc/nginx/tls/cacert.pem https://github.com/joetanx/lab-certs/raw/main/ca/lab_root.pem
curl -sLo /etc/nginx/nginx.conf https://github.com/joetanx/setup/raw/main/nginx.conf
```

Edit Nginx config file to environment parameters:

```sh
cat /etc/nginx/nginx.conf | sed "s/dst_host/$(hostname)/" | sed 's/dst_port/3000/' | tee /etc/nginx/nginx.conf
```

Deploy the Nginx container:

```sh
podman run -d -p 443:443 \
-v /etc/nginx/tls:/etc/nginx/tls:ro \
-v /etc/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
--name nginx docker.io/library/nginx:latest
```

## 4. Deployment via manual install

### 4.1. Preparation

Install necessary packages and configure firewall rules:

```sh
yum -y install mysql-server postgresql-server nodejs jq nginx
firewall-cmd --permanent --add-service mysql && \
firewall-cmd --permanent --add-service postgresql && \
firewall-cmd --permanent --add-port 3000/tcp && \
firewall-cmd --permanent --add-service https && \
firewall-cmd --reload
```

### 4.2. Setup Databases

#### 4.2.1. MySQL

Enable and populate database:

```sh
systemctl enable --now mysqld
curl -sLo /tmp/users.auth.my.sql https://github.com/joetanx/usersapp/raw/main/users.auth.my.sql
mysql -u root < /tmp/users.auth.my.sql
```

Create `node` database user:

```sh
mysql -u root -e "CREATE USER 'node'@'%' IDENTIFIED BY 'password';"
mysql -u root -e "GRANT ALL PRIVILEGES ON users.* TO 'node'@'%';"
```

<details><summary>MySQL Test Queries:</summary>

Retrieve a random row:

```sh
mysql -u root -e "SELECT guid,email,password FROM users.auth ORDER BY RAND() LIMIT 0,1;"
```

Search for a user:

```sh
mysql -u root -e "SELECT guid,email,password FROM users.auth WHERE email LIKE '%jack%';"
```

</details>

#### 4.2.2. PostgreSQL

Initialize, enable and populate database:

```sh
postgresql-setup --initdb
systemctl enable --now postgresql
curl -sLo /tmp/users.data.pg.sql https://github.com/joetanx/usersapp/raw/main/users.data.pg.sql
sudo -u postgres psql -d postgres -f /tmp/users.data.pg.sql
```

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

Configure `/var/lib/pgsql/data/postgresql.conf` to listen on all addresses and enable `scram-sha-256` hashing:

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

Restart PostgreSQL:

```
systemctl restart postgresql
```

Create `node` database user:

```
sudo -u postgres psql -c "CREATE ROLE node WITH LOGIN PASSWORD 'password';"
sudo -u postgres psql -d users -c "GRANT ALL ON data TO node;"
```

Reset user password (if needed):

```
sudo -u postgres psql -c "ALTER USER node WITH PASSWORD 'password';"
```

<details><summary>PostgreSQL Test Queries:</summary>

Retrieve a random row:

```sh
sudo -u postgres psql -d users -c "SELECT guid,firstName,lastName,username,mobile FROM data ORDER BY RANDOM() LIMIT 1 OFFSET 0;"
```

Search for a user:

```sh
sudo -u postgres psql -d users -c "SELECT guid,firstName,lastName,username,mobile FROM data WHERE LOWER(firstName) LIKE '%jack%';"
```

</details>

#### 4.2.3. Clean-up

```sh
rm -f /tmp/users-my.sql /tmp/users-pg.sql /root/.mysql_history /var/lib/pgsql/.psql_history /root/.psql_history
```

### 4.3. Deploy Node.js Application

Install NPM modules, create `.env` file and download keys, application code and view templates:

```sh
mkdir -p /etc/usersapp/views /etc/usersapp/pki
cd /etc/usersapp
npm install express express-session mysql2 pg path dotenv bcrypt hbs jsonwebtoken cookie-parser
cat << EOF > /etc/usersapp/.env
MY_HOST = $(hostname)
MY_DB = users
MY_USER = node
MY_PASSWORD = password
PG_HOST = $(hostname)
PG_DB = users
PG_USER = node
PG_PASSWORD = password
JWT_PRIVATE_KEY = /etc/usersapp/pki/jwt.key
JWT_PUBLIC_KEY = /etc/usersapp/pki/jwt.pem
EOF
curl -sLo /etc/usersapp/pki/jwt.key https://github.com/joetanx/lab-certs/raw/main/ca/lab_issuer.key
curl -sLo /etc/usersapp/pki/jwt.pem https://github.com/joetanx/lab-certs/raw/main/ca/lab_issuer.pem
curl -sLo /etc/usersapp/app.js https://github.com/joetanx/usersapp/raw/main/app.js
curl -sLo /etc/usersapp/views/index.hbs https://github.com/joetanx/usersapp/raw/main/index.html
curl -sLo /etc/usersapp/views/login.hbs https://github.com/joetanx/usersapp/raw/main/login.html
curl -sLo /etc/usersapp/views/register.hbs https://github.com/joetanx/usersapp/raw/main/register.html
curl -sLo /etc/usersapp/views/home.hbs https://github.com/joetanx/usersapp/raw/main/home.html
curl -sLo /etc/usersapp/views/message.hbs https://github.com/joetanx/usersapp/raw/main/message.html
```

Run the application:

```sh
node app.js
```

<details><summary>Run Node.js application as <code>systemd</code> unit file:</summary>

```sh
cat << EOF > /lib/systemd/system/usersapp.service
[Unit]
Description=Run node.js usersapp
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /etc/usersapp/app.js
Restart=on-failure
WorkingDirectory=/etc/usersapp

[Install]
WantedBy=multi-user.target
EOF
systemctl enable --now usersapp
```

</details>

### 4.3. Deploy Nginx

Nginx is used for reverse proxy and SSL termination.

Download certificates and Nginx config file:

```sh
mkdir /etc/nginx/tls
curl -sLo /etc/nginx/tls/server.pem https://github.com/joetanx/lab-certs/raw/main/others/$(hostname).pem
curl -sLo /etc/nginx/tls/server.key https://github.com/joetanx/lab-certs/raw/main/others/$(hostname).key
curl -sLo /etc/nginx/tls/cacert.pem https://github.com/joetanx/lab-certs/raw/main/ca/lab_issuer.pem
curl -sLo /etc/nginx/nginx.conf https://github.com/joetanx/setup/raw/main/nginx.conf
```

Edit Nginx config file to environment parameters:

```sh
cat /etc/nginx/nginx.conf | sed "s/dst_host/$(hostname)/" | sed 's/dst_port/3000/' | tee /etc/nginx/nginx.conf
```

Configure SELinux setting to allow Nginx to connect Node.js:

```sh
setsebool -P httpd_can_network_connect 1
getsebool -a | grep httpd_can_network_connect
```

Deploy the Nginx:

```sh
systemctl enable --now nginx
```
