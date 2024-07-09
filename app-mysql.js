const express = require('express')
const bcrypt = require('bcrypt')
const mysql = require('mysql2')
const dotenv = require('dotenv')
const path = require('path')
const os = require('os')
dotenv.config({ path: './.env' })

const jwt = require('jsonwebtoken')
const fs = require('fs')
const crypto = require('crypto')
const cookieParser = require('cookie-parser')
const privateKey = fs.readFileSync('lab_issuer.key', 'utf8') // Load private key
const publicKey = fs.readFileSync('lab_issuer.pem', 'utf8') // Load public key

const connectionConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DATABASE
}

const client = mysql.createConnection(connectionConfig)

const app = express()
const port = 3000

// Middleware to parse JSON bodies
app.use(express.json())

// Middleware to parse x-www-form-urlencoded bodies
app.use(express.urlencoded({ extended: false }))

// Middleware to generate pages using hbs
app.use(express.static(path.join(__dirname, 'static')))
app.set('view engine', 'hbs')
app.set('views', path.join(__dirname, 'views'))

// Middleware to parse cookies
app.use(cookieParser())

// Route for home page
app.get('/', (request, response) => {
  response.render('index')
})

// Route for login page
app.get('/login', (request, response) => {
  response.render('login')
})

// Route for register page
app.get('/register', (request, response) => {
  response.render('register')
})

// SQL queries
const getUserQuery = `SELECT * FROM users WHERE email = ?`
const insertQuery = `
  INSERT INTO users (id, firstName, lastName, username, email, mobile, password)
  VALUES (DEFAULT, ?, ?, ?, ?, ?, ?)
`

// Route for user login (for browser)
app.post('/auth/login', async (request, response) => {
  const { email, password } = request.body

  try {
    const [user] = await client.promise().execute(getUserQuery, [email])

    if (user.length == 0) {
      return response.status(404).render('message', { subject: "Authentication failed", message: 'User not found' })
    }

    const match = await bcrypt.compare(password, user[0].password)

    if (match) {
      // Create JWT token
      const token = jwt.sign({ email: user[0].email }, privateKey, {
        algorithm: 'ES384',
        expiresIn: '8m'
      })

      // Set cookie with JWT token
      response.cookie('jwt', token, {
        httpOnly: true,
        secure: false // Set to true in production (HTTPS)
      })

      // Redirect to home page
      response.redirect('/home')
    } else {
      response.status(401).render('message', { subject: "Authentication failed", message: 'Incorrect password' })
    }

  } catch (error) {
    console.error('Error verifying password:', error)
    response.status(500).render('message', { subject: "Oops, we've hit an error!", message: 'Internal server error' })
  }
})

// Route for user registration (for browser)
app.post('/auth/register', async (request, response) => {
  const { firstName, lastName, username, email, mobile, password } = request.body

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 12)

  // Prepare SQL query to insert new user


  try {
    // Check if email already exists
    const [user] = await client.promise().execute(getUserQuery, [email])

    // If there is an existing user with the same email
    if (user.length > 0) {
      return response.status(400).render('message', { subject: "Registration failed", message: 'Email address is already registered' })
    }

    // Execute the insert query
    await client.promise().execute(insertQuery, [firstName, lastName, username, email, mobile, hashedPassword])

    response.render('message', { subject: "Registration completed", message: `User ${username} successfully registered` })

  } catch (error) {
    console.error('Error inserting user:', error)
    response.status(500).render('message', { subject: "Oops, we've hit an error!", message: 'Internal server error' })
  }
})

// Route for user home page after login (for browser)
app.get('/home', async (request, response) => {
  const token = request.cookies.jwt

  if (!token) {
    return response.status(401).render('message', { subject: "Unauthorized", message: 'Please log in' })
  }

  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['ES384'] })

    // Query database to fetch user details based on decoded email
    const [user] = await client.promise().execute(getUserQuery, [decoded.email])

    if (user.length == 0) {
      return response.status(404).render('message', { subject: "Unauthorized", message: 'User not found' })
    }

    // Render home.html with user details
    response.render('home', {
      firstName: user[0].firstName,
      lastName: user[0].lastName,
      id: user[0].id,
      username: user[0].username,
      email: user[0].email,
      mobile: user[0].mobile
    })

  } catch (error) {
    console.error('Error verifying token:', error)
    response.status(401).render('message', { subject: "Unauthorized", message: 'Please log in' })
  }
})

// Route for user login (for API)
app.post('/api/login', async (request, response) => {
  const { email, password } = request.body

  try {
    const [user] = await client.promise().execute(getUserQuery, [email])

    if (user.length == 0) {
      return response.status(404).json({ error: 'User not found' })
    }

    const match = await bcrypt.compare(password, user[0].password)

    if (match) {
      // Create JWT token
      const token = jwt.sign({ email: user[0].email }, privateKey, {
        algorithm: 'ES384',
        expiresIn: '8m'
      })

      response.json({
        authentication: 'Successful',
        authorization: `${token}`,
        message: `Welcome, ${user[0].username}`

      })
    } else {
      response.status(401).json({ error: 'Incorrect password' })
    }

  } catch (error) {
    console.error('Error verifying password:', error)
    response.status(500).json({ error: 'Internal server error' })
  }
})

// Route for user retrieve after login (for API)
app.get('/api/userinfo', async (request, response) => {
  const token = request.headers.authorization

  if (!token) {
    return response.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['ES384'] })

    // Query database to fetch user details based on decoded email
    const [user] = await client.promise().execute(getUserQuery, [decoded.email])

    if (user.length == 0) {
      return response.status(404).json({ error: 'User not found' })
    }

    response.json({
      id: user[0].id,
      firstName: user[0].firstName,
      lastName: user[0].lastName,
      username: user[0].username,
      email: user[0].email,
      mobile: user[0].mobile
    })

  } catch (error) {
    console.error('Error verifying token:', error)
    response.status(401).json({ error: 'Unauthorized' })
  }
})

// Start server
app.listen(port, () => {
  console.log(`Verification service listening at http://${os.hostname()}:${port}`)
})
