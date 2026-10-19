import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Ad2ship/Influencer Mangement Software/backend/.env' });

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/influencer_db_local');
  const db = mongoose.connection.db!;

  // 1. Update employees collection
  const empRes = await db.collection('employees').updateMany(
    { $or: [{ email: 'mouli.pandey@ad2ship.com' }, { name: { $regex: /^(mouli|maouli)$/i } }] },
    { $set: { name: 'Mouli Pandey' } }
  );
  console.log('Updated employees:', empRes.modifiedCount);

  // Trim Nitin
  await db.collection('employees').updateMany(
    { name: 'Nitin ' },
    { $set: { name: 'Nitin' } }
  );

  // 2. Update users collection
  const userRes = await db.collection('users').updateMany(
    { $or: [{ email: 'mouli.pandey@ad2ship.com' }, { name: { $regex: /^(mouli|maouli)$/i } }] },
    { $set: { name: 'Mouli Pandey' } }
  );
  console.log('Updated users:', userRes.modifiedCount);

  // 3. Update influencers collection
  const infRes = await db.collection('influencers').updateMany(
    { influencerManager: { $regex: /^(mouli|maouli)( pandey)?$/i } },
    { $set: { influencerManager: 'Mouli Pandey' } }
  );
  console.log('Updated influencers to Mouli Pandey:', infRes.modifiedCount);

  // Check counts
  const distinctMgrs = await db.collection('influencers').distinct('influencerManager');
  console.log('Distinct influencer managers after update:', distinctMgrs);

  process.exit(0);
}

migrate();
