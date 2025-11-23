// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb+srv://abdulhalimtehnik:Halim02154db@cluster.4k0uiwr.mongodb.net/event_registration', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Event Schema
const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['workshop', 'seminar', 'conference', 'training', 'webinar'],
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  maxParticipants: {
    type: Number,
    required: true,
    min: 1
  },
  currentParticipants: {
    type: Number,
    default: 0
  },
  speaker: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  }
}, {
  timestamps: true
});

// Registration Schema
const registrationSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  participantName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  organization: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'confirmed'
  }
}, {
  timestamps: true
});

const Event = mongoose.model('Event', eventSchema);
const Registration = mongoose.model('Registration', registrationSchema);

// ============ EVENT ROUTES ============

// Get all events
app.get('/api/events', async (req, res) => {
  try {
    const { category, status } = req.query;
    let filter = {};
    
    if (category) filter.category = category;
    if (status) filter.status = status;
    
    const events = await Event.find(filter).sort({ date: 1 });
    res.json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching events',
      error: error.message
    });
  }
});

// Get single event
app.get('/api/events/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching event',
      error: error.message
    });
  }
});

// Create new event
app.post('/api/events', async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();
    
    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating event',
      error: error.message
    });
  }
});

// Update event
app.put('/api/events/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Event updated successfully',
      data: event
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating event',
      error: error.message
    });
  }
});

// Delete event
app.delete('/api/events/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Delete all registrations for this event
    await Registration.deleteMany({ eventId: req.params.id });
    
    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting event',
      error: error.message
    });
  }
});

// ============ REGISTRATION ROUTES ============

// Get all registrations
app.get('/api/registrations', async (req, res) => {
  try {
    const { eventId, status } = req.query;
    let filter = {};
    
    if (eventId) filter.eventId = eventId;
    if (status) filter.status = status;
    
    const registrations = await Registration.find(filter)
      .populate('eventId', 'title date location');
    
    res.json({
      success: true,
      count: registrations.length,
      data: registrations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching registrations',
      error: error.message
    });
  }
});

// Get single registration
app.get('/api/registrations/:id', async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id)
      .populate('eventId');
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }
    
    res.json({
      success: true,
      data: registration
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching registration',
      error: error.message
    });
  }
});

// Create new registration
app.post('/api/registrations', async (req, res) => {
  try {
    const event = await Event.findById(req.body.eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
    
    // Check if event is full
    if (event.currentParticipants >= event.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Event is full'
      });
    }
    
    // Check if event is cancelled
    if (event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot register for cancelled event'
      });
    }
    
    const registration = new Registration(req.body);
    await registration.save();
    
    // Update event participant count
    event.currentParticipants += 1;
    await event.save();
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: registration
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating registration',
      error: error.message
    });
  }
});

// Update registration
app.put('/api/registrations/:id', async (req, res) => {
  try {
    const registration = await Registration.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Registration updated successfully',
      data: registration
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating registration',
      error: error.message
    });
  }
});

// Cancel registration
app.delete('/api/registrations/:id', async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }
    
    // Update event participant count
    const event = await Event.findById(registration.eventId);
    if (event && event.currentParticipants > 0) {
      event.currentParticipants -= 1;
      await event.save();
    }
    
    await registration.deleteOne();
    
    res.json({
      success: true,
      message: 'Registration cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling registration',
      error: error.message
    });
  }
});

// Get registrations for specific event
app.get('/api/events/:id/registrations', async (req, res) => {
  try {
    const registrations = await Registration.find({ 
      eventId: req.params.id 
    });
    
    res.json({
      success: true,
      count: registrations.length,
      data: registrations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching event registrations',
      error: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Event Registration API',
    version: '1.0.0',
    endpoints: {
      events: '/api/events',
      registrations: '/api/registrations'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;