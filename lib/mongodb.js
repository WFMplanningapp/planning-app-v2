import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env'
  );
}
if (!MONGODB_DB) {
  throw new Error(
    'Please define the MONGODB_DB environment variable inside .env'
  );
}

let cached = global.mongo;
if (!cached) {
  cached = global.mongo = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = MongoClient.connect(MONGODB_URI)
      .then((client) => {
        return {
          client,
          db: client.db(MONGODB_DB),
        };
      })
      .catch((error) => {
        console.error('Failed to connect to MongoDB', error);
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export const addToDatabase = async (db, collection, items) => {
  let response = await db[collection].insertMany(items);
 // console.log('Data added to Database');
  return response;
};

export const updateInDatabase = async (db, collection, query, item) => {
  const update = { $set: item };
  const options = { upsert: true };
  let response = await db
    .collection(collection)
    .updateOne(query, update, options);
  //console.log('Updated data in Database');
  return response;
};

export const deleteInDatabase = async (db, collection, query) => {};

export const getFromDatabase = async (db, collection, query) => {
  let response = await db.collection(collection).find(query).toArray();
  //console.log('Data retreived from Database');
  return response;
};
