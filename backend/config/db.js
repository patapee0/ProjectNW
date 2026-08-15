/**
 * MongoDB Connection Configuration using Mongoose
 */
const mongoose = require('mongoose');

// Disable buffering so queries fail fast or fall back to memory store when DB is not running
mongoose.set('bufferCommands', false);

let isMongoConnected = false;

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kku-dating';
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 2000 });
    isMongoConnected = true;
    console.log('✅ MongoDB Connected Successfully');
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`   Host: ${mongoose.connection.host}`);
  } catch (error) {
    isMongoConnected = false;
    console.log('⚠️  MongoDB Connection Notice:', error.message);
    console.log('⚠️  Running in simulation mode (using in-memory fallback store)');
  }
};

const getIsConnected = () => isMongoConnected && mongoose.connection.readyState === 1;

module.exports = { connectDB, getIsConnected };
