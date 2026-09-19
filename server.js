const express = require('express');
// var createError = require('http-errors');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
require('./config/passport');
require('dotenv').config();

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const adminRouter = require('./routes/admin');

const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 8000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://hrithikelayur12_db_user:iRIFZyWr6uZEE5k9@luana-paris.ei5r1tm.mongodb.net/luvana-paris';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  // useNewUrlParser: true,
  // useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: 'luvana_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

app.use('/', indexRouter);
app.use('/user', usersRouter);
app.use('/admin', adminRouter);

app.use((req, res) => {
  res.status(404);
  res.send('<h1>Error 404: Resource not found</h1>')
});
// catch 404 and forward to error handler
// app.use(function(req, res, next) {
//   next(createError(404));
// });

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost: ${PORT}`);
});
// error handler
// Errors reach API clients as JSON they can read ({ message }) rather than an HTML
// page: malformed JSON bodies, oversized requests and anything unexpected.
app.use(function(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  const message =
    err.type === 'entity.parse.failed' ? 'The request body is not valid JSON.'
    : err.type === 'entity.too.large' ? 'The request is too large.'
    : status >= 500 ? 'Internal server error'
    : err.expose ? err.message : 'Bad request';
  res.status(status).json({ message });
});

module.exports = app;
