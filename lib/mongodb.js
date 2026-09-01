import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;
const APP_ENV = process.env.APP_ENV;

const ALLOWED_DATABASES = Object.freeze({
  demo: 'planning-app-demo',
  production: 'live',
});

function validateDatabaseConfiguration() {
  if (!MONGODB_URI) {
    throw new Error(
      'Missing required MONGODB_URI environment variable.'
    );
  }

  if (!MONGODB_DB) {
    throw new Error(
      'Missing required MONGODB_DB environment variable.'
    );
  }

  if (!APP_ENV) {
    throw new Error(
      'Missing required APP_ENV environment variable. Expected "demo" or "production".'
    );
  }

  const expectedDatabase = ALLOWED_DATABASES[APP_ENV];

  if (!expectedDatabase) {
    throw new Error(
      `Unsupported APP_ENV "${APP_ENV}". Expected "demo" or "production".`
    );
  }

  if (MONGODB_DB !== expectedDatabase) {
    throw new Error(
      `Database safety check failed: APP_ENV "${APP_ENV}" cannot use database "${MONGODB_DB}".`
    );
  }
}

function validateConnectedDatabase(connection) {
  const connectedDatabase = connection?.db?.databaseName;

  if (!connectedDatabase || connectedDatabase !== MONGODB_DB) {
    throw new Error(
      'Database safety check failed: the connected database does not match the configured database.'
    );
  }

  return connection;
}

validateDatabaseConfiguration();

let cached = global.mongo;

if (!cached) {
  cached = global.mongo = {
    conn: null,
    promise: null,
    appEnv: APP_ENV,
    databaseName: MONGODB_DB,
  };
}

function validateCachedConfiguration() {
  if (
    cached.appEnv &&
    cached.databaseName &&
    (cached.appEnv !== APP_ENV || cached.databaseName !== MONGODB_DB)
  ) {
    throw new Error(
      'Database safety check failed: the cached connection belongs to a different environment.'
    );
  }

  cached.appEnv = APP_ENV;
  cached.databaseName = MONGODB_DB;
}

export async function connectToDatabase() {
  validateDatabaseConfiguration();
  validateCachedConfiguration();

  if (cached.conn) {
    return validateConnectedDatabase(cached.conn);
  }

  if (!cached.promise) {
    cached.promise = MongoClient.connect(MONGODB_URI)
      .then((client) => {
        const connection = {
          client,
          db: client.db(MONGODB_DB),
        };

        return validateConnectedDatabase(connection);
      })
      .catch((error) => {
        cached.promise = null;
        console.error(
          `Failed to connect to the configured MongoDB database for APP_ENV "${APP_ENV}".`
        );
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return validateConnectedDatabase(cached.conn);
}

export const addToDatabase = async (db, collection, items) => {
  const response = await db[collection].insertMany(items);
  return response;
};

export const updateInDatabase = async (db, collection, query, item) => {
  const update = { $set: item };
  const options = { upsert: true };

  const response = await db
    .collection(collection)
    .updateOne(query, update, options);

  return response;
};

export const deleteInDatabase = async (db, collection, query) => {};

export const getFromDatabase = async (db, collection, query) => {
  const response = await db.collection(collection).find(query).toArray();
  return response;
};
