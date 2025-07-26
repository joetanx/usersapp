const express = require('express')
const bcrypt = require('bcrypt')
const dotenv = require('dotenv')
const path = require('path')
const os = require('os')
dotenv.config({ path: './.env' })

const jwt = require('jsonwebtoken')
const fs = require('fs')
const cookieParser = require('cookie-parser')
const privateKey = fs.readFileSync(process.env.JWT_PRIVATE_KEY, 'utf8') // Load private key
const publicKey = fs.readFileSync(process.env.JWT_PUBLIC_KEY, 'utf8') // Load public key

const { randomUUID } = require('crypto');

const myConnectionConfig = {
  host: process.env.MY_HOST,
  database: process.env.MY_DB,
  user: process.env.MY_USER,
  password: process.env.MY_PASSWORD
}
const mysql = require('mysql2')
const myClient = mysql.createConnection(myConnectionConfig)

const pgConnectionConfig = {
  host: process.env.PG_HOST,
  database: process.env.PG_DB,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD
}
const { Client } = require('pg')
const pgClient = new Client(pgConnectionConfig)
pgClient.connect().then(() => console.log('Connected to PostgreSQL database'))

// MySQL queries
const getUserAuthByEmail = `SELECT * FROM auth WHERE email = ?`
const getUserAuthByGuid = `SELECT * FROM auth WHERE guid = ?`
const insertUserAuth = `INSERT INTO auth (guid, email, password) VALUES (?, ?, ?)`

// PostgreSQL queries
const getUserDataByGuid = `SELECT * FROM data WHERE guid = $1`
const insertUserData = `INSERT INTO data (guid, firstname, lastname, username, mobile) VALUES ($1, $2, $3, $4, $5)`

// Setup express app
const app = express()
const port = 3000

// Setup middleware parsing
app.use(express.json()) //parse JSON bodies
app.use(express.urlencoded({ extended: false })) //parse x-www-form-urlencoded bodies
app.use(cookieParser()) //parse cookies

// Setup middleware view engine to generate pages using hbs
app.use(express.static(path.join(__dirname, 'static')))
app.set('view engine', 'hbs')
app.set('views', path.join(__dirname, 'views'))

// Routes
app.get('/', (request, response) => response.render('index'))
app.get('/login', (request, response) => response.render('login'))
app.get('/register', (request, response) => response.render('register'))

async function userCheck(email) {
  // MySQL: users.auth
  const user = await myClient.promise().execute(getUserAuthByEmail, [email])
  return user[0][0]
}

async function userDetails(guid) {
  // MySQL: users.auth
  const auth = await myClient.promise().execute(getUserAuthByGuid, [guid])
  // PostgreSQL: users.data
  const data = await pgClient.query(getUserDataByGuid, [guid])
  return {
    guid: guid,
    firstname: data.rows[0].firstname,
    lastname: data.rows[0].lastname,
    username: data.rows[0].username,
    email: auth[0][0].email,
    mobile: data.rows[0].mobile
  };
}

async function userReg(params) {
  const hashedPassword = await bcrypt.hash(params.password, 12)
  const guid = randomUUID();
  // MySQL: users.auth
  await myClient.promise().execute(insertUserAuth, [guid, params.email, hashedPassword])
  // PostgreSQL: users.data
  await pgClient.query(insertUserData, [guid, params.firstName, params.lastName, params.username, params.mobile])
}

function generateToken(guid) {
  return jwt.sign({ guid }, privateKey, {
    algorithm: 'ES384',
    expiresIn: '8m'
  })
}

function verifyToken(token) {
  try {
    return jwt.verify(token, publicKey, { algorithms: ['ES384'] })
  } catch (error) {
    throw new Error('Unauthorized: Error verifying JWT')
  }
}

// Route for user login (for browser)
app.post('/auth/login', async (request, response) => {
  const { email, password } = request.body

  try {
    const auth = await userCheck(email)
    if (!auth) return response.status(404).render('message', { subject: 'Authentication failed', message: 'User not found' })

    const match = await bcrypt.compare(password, auth.password)
    if (!match) return response.status(401).render('message', { subject: 'Authentication failed', message: 'Incorrect password' })

    const token = generateToken(auth.guid)
    response.cookie('jwt', token, {
      httpOnly: true,
      secure: false // Set to true in production (HTTPS)
    })
    response.redirect('/home')

  } catch (error) {
    console.error('User login error:', error)
    response.status(500).render('message', { subject: "Oops, we've hit an error!", message: 'Internal server error' })
  }
})

// Route for user registration (for browser)
app.post('/auth/register', async (request, response) => {
  const { firstName, lastName, username, email, mobile, password } = request.body

  try {
    // Check if email already exists
    const existingUser = await userCheck(email)
    if (existingUser) return response.status(400).render('message', { subject: 'Registration failed', message: 'Email address is already registered' })

    await userReg({ firstName, lastName, username, email, mobile, password })
    response.render('message', { subject: 'Registration completed', message: `User ${username} successfully registered` })
  } catch (error) {
    console.error('Error inserting user:', error)
    response.status(500).render('message', { subject: 'Oops, we\'ve hit an error!', message: 'Internal server error' })
  }
})

// Route for user home page after login (for browser)
app.get('/home', async (request, response) => {
  const token = request.cookies.jwt
  if (!token) return response.status(401).render('message', { subject: 'Unauthorized', message: 'Please log in' })

  try {
    const decoded = verifyToken(token)
    const user = await userDetails(decoded.guid)

    if (!user) return response.status(404).render('message', { subject: 'Unauthorized', message: 'User not found' })

    response.render('home', {
      guid: user.guid,
      firstName: user.firstname,
      lastName: user.lastname,
      username: user.username,
      email: user.email,
      mobile: user.mobile
    })
  } catch (error) {
    console.error('Home page error:', error)
    response.status(401).render('message', { subject: "Unauthorized", message: 'Please log in' })
  }
})

// Route for user login (for API)
app.post('/api/login', async (request, response) => {
  const { email, password } = request.body

  try {
    const auth = await userCheck(email)
    if (!auth) return response.status(404).json({ error: 'User not found' })

    const match = await bcrypt.compare(password, auth.password)
    if (!match) return response.status(401).json({ error: 'Incorrect password' })

    const token = generateToken(auth.guid)
    const user = await userDetails(auth.guid)
    response.json({
      authentication: 'Successful',
      authorization: `${token}`,
      message: `Welcome, ${user.username}`
    })
  } catch (error) {
    console.error('User login API error:', error)
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Route for user retrieve after login (for API)
app.get('/api/userinfo', async (request, response) => {
  const token = request.headers.authorization
  if (!token) return response.status(401).json({ error: 'Unauthorized' })

  try {
    const decoded = verifyToken(token)
    const user = await userDetails(decoded.guid)

    if (!user) return response.status(404).json({ error: 'User not found' })

    response.json({
      guid: user.guid,
      firstName: user.firstname,
      lastName: user.lastname ,
      username: user.username,
      email: user.email,
      mobile: user.mobile
    })
  } catch (error) {
    console.error('User info API error:', error)
    response.status(401).json({ error: 'Unauthorized' })
  }
})

// Start server
app.listen(port, () => {
  console.log(`Verification service listening at http://${os.hostname()}:${port}`)
})