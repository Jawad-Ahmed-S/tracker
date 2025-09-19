// src/app/api/qaza/route.js
import connectDB from "@/lib/mongodb";   // ✅ Default import
import QazaData from "@/models/QazaData";

export async function GET() {
  await connectDB();
  const doc = await QazaData.findOne();
  return new Response(JSON.stringify(doc || {}), { status: 200 });
}

export async function POST(request) {
  await connectDB();
  const body = await request.json();

  // Always use a single document for the single user (first found or create new)
  let doc = await QazaData.findOne();
  // Only create a new document if none exists (first time setup)
  if (!doc) {
    doc = new QazaData({
      date: body.date || 'init',
      prayers: {},
      habits: {},
      logs: {},
      initialQaza: {},
      customFieldNames: {},
      customHabitsConfig: [],
      bulkAdjustments: {},
    });
    await doc.save();
  }

  // Always update the existing document for all future requests
  // (findOneAndUpdate for atomicity)
  const update = {};
  switch (body.type) {
    case 'dailyLog': {
      if (!body.date) return new Response(JSON.stringify({ error: 'Date required' }), { status: 400 });
      update[`logs.${body.date}`] = { ...body.prayers, ...body.habits };
      break;
    }
    case 'initialQaza': {
      update.initialQaza = body.initialQaza || {};
      break;
    }
    case 'customFieldName': {
      update[`customFieldNames.${body.fieldId}`] = body.newName;
      break;
    }
    case 'addHabit': {
      // Use $addToSet to avoid duplicates
      await QazaData.findOneAndUpdate({}, {
        $addToSet: { customHabitsConfig: body.habit },
        $set: { [`customFieldNames.${body.habit.id}`]: body.habit.name }
      });
      return new Response(JSON.stringify({ message: 'Saved!' }), { status: 201 });
    }
    case 'removeHabit': {
      await QazaData.findOneAndUpdate({}, {
        $pull: { customHabitsConfig: { id: body.habitId } },
        $unset: { [`customFieldNames.${body.habitId}`]: '' }
      });
      return new Response(JSON.stringify({ message: 'Saved!' }), { status: 201 });
    }
    case 'bulkLog': {
      const bulkAdjustmentId = `${body.bulkStartDate}_to_${body.bulkEndDate}_${Date.now()}`;
      update[`bulkAdjustments.${bulkAdjustmentId}`] = {
        startDate: body.bulkStartDate,
        endDate: body.bulkEndDate,
        ...body.bulkPrayerCounts,
      };
      break;
    }
    default:
      return new Response(JSON.stringify({ error: 'Unknown type' }), { status: 400 });
  }
  await QazaData.findOneAndUpdate({}, { $set: update });
  return new Response(JSON.stringify({ message: 'Saved!' }), { status: 201 });

  // Handle different types of updates
  switch (body.type) {
    case 'dailyLog': {
      // Save/update daily log for the date
      if (!body.date) return new Response(JSON.stringify({ error: 'Date required' }), { status: 400 });
      if (!doc.logs) doc.logs = {};
      doc.logs[body.date] = { ...body.prayers, ...body.habits };
      break;
    }
    case 'initialQaza': {
      doc.initialQaza = body.initialQaza || {};
      break;
    }
    case 'customFieldName': {
      if (!doc.customFieldNames) doc.customFieldNames = {};
      doc.customFieldNames[body.fieldId] = body.newName;
      break;
    }
    case 'addHabit': {
      if (!doc.customHabitsConfig) doc.customHabitsConfig = [];
      // Avoid duplicates
      if (!doc.customHabitsConfig.some(h => h.id === body.habit.id)) {
        doc.customHabitsConfig.push(body.habit);
      }
      if (!doc.customFieldNames) doc.customFieldNames = {};
      doc.customFieldNames[body.habit.id] = body.habit.name;
      break;
    }
    case 'removeHabit': {
      if (doc.customHabitsConfig) {
        doc.customHabitsConfig = doc.customHabitsConfig.filter(h => h.id !== body.habitId);
      }
      if (doc.customFieldNames) {
        delete doc.customFieldNames[body.habitId];
      }
      break;
    }
    case 'bulkLog': {
      if (!doc.bulkAdjustments) doc.bulkAdjustments = {};
      const bulkAdjustmentId = `${body.bulkStartDate}_to_${body.bulkEndDate}_${Date.now()}`;
      doc.bulkAdjustments[bulkAdjustmentId] = {
        startDate: body.bulkStartDate,
        endDate: body.bulkEndDate,
        ...body.bulkPrayerCounts,
      };
      break;
    }
    default:
      return new Response(JSON.stringify({ error: 'Unknown type' }), { status: 400 });
  }

  await doc.save();
  return new Response(JSON.stringify({ message: 'Saved!' }), { status: 201 });
}
