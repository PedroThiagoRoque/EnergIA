const mongoose = require('mongoose');

const DailyDataSchema = new mongoose.Schema({
  date: {
    type: String, // formato 'YYYY-MM-DD'
    required: true,
    unique: true,
    index: true
  },
  dicaDia: {
    type: String,
    required: true
  },
  temas: {
    type: [String], // array com 10 temas (idealmente)
    default: [],
    validate: {
      validator: function (arr) {
        return Array.isArray(arr);
      },
      message: 'Temas deve ser um array de strings.'
    }
  },
  toasts: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.models.DailyData || mongoose.model('DailyData', DailyDataSchema);