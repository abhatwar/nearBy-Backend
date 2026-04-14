const mongoose = require('mongoose');

let cachedConn = null;
let connectingPromise = null;
let listenersAttached = false;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    cachedConn = mongoose.connection;
    return cachedConn;
  }

  if (mongoose.connection.readyState === 0) {
    cachedConn = null;
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set');
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  try {
    mongoose.set('bufferCommands', false);

    connectingPromise = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    const conn = await connectingPromise;
    cachedConn = conn.connection;

    if (!listenersAttached) {
      mongoose.connection.on('disconnected', () => {
        cachedConn = null;
      });
      mongoose.connection.on('error', () => {
        cachedConn = null;
      });
      listenersAttached = true;
    }

    console.log(`MongoDB connected: ${conn.connection.host}`);
    return cachedConn;
  } catch (err) {
    cachedConn = null;
    console.error(`MongoDB connection error: ${err.message}`);
    throw err;
  } finally {
    connectingPromise = null;
  }
};

module.exports = connectDB;
