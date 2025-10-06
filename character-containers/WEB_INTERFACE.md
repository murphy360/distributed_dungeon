# 🎮 Character Web Interface

Each character container now includes a **built-in web interface** that provides a visual character sheet and management tools!

## 🌐 Accessing Your Character's Web Interface

### **Main Character Sheet**
Open your browser and navigate to:
```
http://localhost:3010
```

Replace `3010` with your character's port if different.

### **Features Available:**

#### 📊 **Interactive Character Sheet**
- **Real-time character stats** (Strength, Dexterity, Constitution, etc.)
- **Health and Mana bars** with visual indicators
- **Combat information** (AC, Attack Bonus, Initiative)
- **Fighter-specific abilities** (Second Wind, Action Surge, Fighting Style)
- **Equipment and inventory** display
- **AI personality settings** with interactive sliders

#### 🤖 **AI Configuration**
- Adjust AI personality traits with sliders:
  - **Aggressiveness**: How aggressive the AI is in combat
  - **Caution**: How careful the AI is with decisions
  - **Exploration**: How curious the AI is about exploring
- Changes are saved automatically

#### 🎯 **Character Actions**
- **Save Character**: Manually save character state
- **Refresh Data**: Update the display with latest information
- **Test AI**: Test AI decision making (coming soon)
- **View Logs**: Open detailed character logs

#### 📝 **Character Logs**
Access at: `http://localhost:3010/logs`
- **Real-time log viewing** with auto-refresh
- **Filter by log level** (Info, Warning, Error, Debug)
- **Search functionality** to find specific events
- **Auto-scroll** to follow new log entries

## 🚀 **How to Use**

### **For Players:**
1. Start your character container
2. Open `http://localhost:3010` in your browser
3. View and monitor your character's status
4. Adjust AI settings as desired
5. Save character state when needed

### **For Dungeon Masters:**
1. Access any player's character sheet using their port
2. Monitor character health and abilities
3. View character logs for debugging
4. Check AI behavior settings

### **For Developers:**
- All data is fetched via REST API endpoints
- Web interface updates automatically every 30 seconds
- Logs refresh every 5 seconds when auto-refresh is enabled
- Full responsive design works on mobile devices

## 🔧 **Technical Details**

### **Endpoints:**
- `GET /` - Main character sheet interface
- `GET /logs` - Logs viewing interface  
- `GET /api/character` - Character data JSON
- `GET /api/ai/status` - AI configuration JSON
- `GET /api/logs` - Log entries JSON
- `PUT /api/ai` - Update AI settings
- `POST /api/character/save` - Save character state

### **Auto-Refresh:**
- Character data: Every 30 seconds
- Logs: Every 5 seconds (when enabled)
- Status indicators: Real-time updates

### **Browser Compatibility:**
- Chrome/Edge/Firefox (modern versions)
- Mobile browsers supported
- No plugins or extensions required

## 📱 **Mobile Support**

The web interface is fully responsive and works great on:
- Smartphones
- Tablets  
- Desktop computers
- Any device with a modern web browser

## 🎨 **Interface Features**

### **Visual Design:**
- **Modern glassmorphism design** with blur effects
- **Color-coded status indicators** (health, connection, AI)
- **Interactive sliders** for AI personality adjustment
- **Responsive grid layout** that adapts to screen size
- **Smooth animations** and hover effects

### **Real-time Updates:**
- Character stats update automatically
- Health/mana bars show current status
- Connection status shows if character is online
- Log viewer shows live updates

### **User Experience:**
- **Single-page application** - no page reloads needed
- **Error handling** with user-friendly messages
- **Loading indicators** during data fetches
- **Keyboard shortcuts** in log viewer
- **Tooltips and help text** for all features

## 🔐 **Security**

The web interface includes:
- **Rate limiting** to prevent API abuse
- **CORS protection** for cross-origin requests
- **Input validation** on all endpoints
- **Error sanitization** to prevent information leaks

## 🛠 **Troubleshooting**

### **Common Issues:**

#### **Web interface won't load:**
- Check if container is running: `docker-compose ps`
- Verify port mapping in docker-compose.yml
- Check container logs: `docker-compose logs fighter-character`

#### **Character data not showing:**
- Refresh the page
- Check API endpoint: `curl http://localhost:3010/api/character`
- Check character container health: `curl http://localhost:3010/health`

#### **Logs not loading:**
- Verify log files exist in container
- Check API logs endpoint: `curl http://localhost:3010/api/logs`
- Check container file permissions

### **Port Conflicts:**
If port 3010 is in use, modify `.env` file:
```bash
CHARACTER_PORT=3011  # Use different port
```

## 🎯 **Next Steps**

This web interface provides a foundation for:
- **Multi-character party management**
- **DM tools and overrides**
- **Combat encounter interfaces**
- **Real-time game session monitoring**
- **Character progression tracking**
- **Campaign management tools**

---

🎮 **Happy Gaming!** Your character is now accessible through a modern, user-friendly web interface that makes managing your character easier than ever!