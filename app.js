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

const connectionConfig = {
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
}

const supportedDbTypes = ['mysql', 'pgsql']
const dbType = process.env.DB_TYPE
if (!supportedDbTypes.includes(dbType)) throw new Error('Invalid database type')

// Prepare queries
const getUserQuery = (dbType == 'pgsql') ? `SELECT * FROM users WHERE email = $1` : `SELECT * FROM users WHERE email = ?`
const insertUserQuery = (dbType == 'pgsql') ? `INSERT INTO users (id, firstname, lastname, username, email, mobile, password) VALUES (DEFAULT, $1, $2, $3, $4, $5, $6)` : `INSERT INTO users (id, firstName, lastName, username, email, mobile, password) VALUES (DEFAULT, ?, ?, ?, ?, ?, ?)`

let client

if (process.env.DB_TYPE == 'mysql') {
  const mysql = require('mysql2')
  client = mysql.createConnection(connectionConfig)
} else if (process.env.DB_TYPE == 'pgsql') {
  const { Client } = require('pg')
  client = new Client(connectionConfig)
  client.connect().then(() => console.log('Connected to PostgreSQL database'))
}

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

async function queryUser(email) {
  const user = (dbType == 'pgsql') ? await client.query (getUserQuery, [email]) : await client.promise().execute(getUserQuery, [email])
  return user.rows ? user.rows[0] : user[0][0]
}

async function insertUser(params) {
  const hashedPassword = await bcrypt.hash(params.password, 12)
  await (dbType == 'pgsql') ? client.query(insertUserQuery, [params.firstName, params.lastName, params.username, params.email, params.mobile, hashedPassword]) : client.promise().execute(insertUserQuery, [params.firstName, params.lastName, params.username, params.email, params.mobile, hashedPassword])
}

function generateToken(email) {
  return jwt.sign({ email }, privateKey, {
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
    const user = await queryUser(email)
    if (!user) return response.status(404).render('message', { subject: 'Authentication failed', message: 'User not found' })

    const match = await bcrypt.compare(password, user.password)
    if (!match) return response.status(401).render('message', { subject: 'Authentication failed', message: 'Incorrect password' })

    const token = generateToken(email)
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
    const existingUser = await queryUser(email)
    if (existingUser) return response.status(400).render('message', { subject: 'Registration failed', message: 'Email address is already registered' })

    await insertUser({ firstName, lastName, username, email, mobile, password })
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
    const user = await queryUser(decoded.email)

    if (!user) return response.status(404).render('message', { subject: 'Unauthorized', message: 'User not found' })

    response.render('home', {
      id: user.id,
      firstName: user.firstname || user.firstName,
      lastName: user.lastname || user.lastName,
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
    const user = await queryUser(email, password)
    if (!user) return response.status(404).json({ error: 'User not found' })

    const match = await bcrypt.compare(password, user.password)
    if (!match) return response.status(401).json({ error: 'Incorrect password' })

    const token = generateToken(email)
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
    const user = await queryUser(decoded.email)

    if (!user) return response.status(404).json({ error: 'User not found' })

    response.json({
      id: user.id,
      firstName: user.firstname || user.firstName,
      lastName: user.lastname || user.lastName,
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
