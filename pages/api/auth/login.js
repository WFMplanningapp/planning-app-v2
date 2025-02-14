import { compareSync, hashSync } from 'bcrypt';
import { connectToDatabase } from '../../../lib/mongodb';

/*
REQUEST (POST)

<Body>
username: STRING
password: STRING

RESPONSE

(200)
message: STRING
logged: BOOLEAN
token: STRING || Null
*/

export default async function handler(req, res) {
  const { query, method, body } = req;

  //console.log(body)
  const { client, db } = await connectToDatabase();

  if (method === 'POST') {
    //FIND USER
    const user = await db
      .collection('verification')
      .findOne({ username: body.username });

    //console.log(user)

    //USER EXISTS

    if (user && body.password) {
      let compare = compareSync(body.password, user ? user.password : 'x');

      if (compare) {
        //CREDENTIALS MATCH
        let timestamp = Date.now();

        let token =
          user.session && user.session.expires > timestamp
            ? user.session.token
            : hashSync(user.username + new Date(timestamp).toISOString(), 10);

        //console.log(token)
        let session = {
          token,
          expires: timestamp + 43200000,
        };
        //console.log(session)

        db.collection('verification').updateOne(
          { username: user.username },
          {
            $set: {
              session,
            },
          }
        );

        res.status(200).json({
          message: 'Login successful!',
          logged: true,
          user: {
            ...user,
            password: 'nice try...',
            session,
          },
        });
      } else {
        res.status(200).json({
          message: 'Credentials incorrect!',
          logged: false,
          user: null,
        });
      }
    } //USER DOES NOT EXIST
    else {
      res.status(200).json({
        message: 'Credentials incorrect!',
        logged: false,
        user: null,
      });
    }
    //BAD REQUEST
  } else {
    res.status(405).json({ message: 'Method not Allowed, use POST only' });
  }
}
