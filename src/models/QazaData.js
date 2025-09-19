// models/QazaData.js
import mongoose from "mongoose";

const QazaDataSchema = new mongoose.Schema({
  date: { type: String, required: true },
  prayers: {
    fajr: { current: String, qaza: String },
    dhuhr: { current: String, qaza: String },
    asr: { current: String, qaza: String },
    maghrib: { current: String, qaza: String },
    isha: { current: String, qaza: String },
  },
  habits: {
    quran: Number,
    zikr: Number,
  },
  // --- Dynamic fields for tracker ---
  logs: { type: mongoose.Schema.Types.Mixed, default: {} },
  initialQaza: { type: mongoose.Schema.Types.Mixed, default: {} },
  customFieldNames: { type: mongoose.Schema.Types.Mixed, default: {} },
  customHabitsConfig: { type: Array, default: [] },
  bulkAdjustments: { type: mongoose.Schema.Types.Mixed, default: {} },
});

export default mongoose.models.QazaData || mongoose.model("QazaData", QazaDataSchema);
