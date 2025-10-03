import { connectToDatabase } from '../../../lib/mongodb';
import { hashSync } from 'bcryptjs';
import { verifySession } from '../../../lib/verification';

export default async function handler(req, res) {
  const { query, method, body, headers } = req;

  //console.log(body)
  const { client, db } = await connectToDatabase();

  if (method === 'PUT') {
    let verification = await verifySession(db, headers.authorization);

    //USER EXISTS

    if (verification.verified && body.password) {
      let hashed = hashSync(body.password, 10);
      if (body.password.length > 7) {
        db.collection('verification').updateOne(
          { username: verification.user.username },
          {
            $set: {
              password: hashed,
            },
          }
        );

        res.status(200).json({
          message: 'Password udpdate successful!',
        });
      } else {
        res.status(301).json({
          message: 'Invalid Password',
        });
      }
    } //NOT VERIFIED
    else {
      res.status(305).json({
        message: 'Unauthorized!',
      });
    }
    //BAD REQUEST
  } else {
    res.status(405).json({ message: 'Method not Allowed, use PUT only' });
  }
}
