// designer_server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Set View Engine (uses existing views folder)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json()); // Support JSON bodies

// Main Route
app.get('/', (req, res) => {
    // We will create this view next
    res.render('designer/index', {
        title: 'Coyote Camporee Designer'
    });
});

// Serve Static Files (Shares the 'public' folder with the main app)
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`Camporee Designer is running safely on Port ${PORT}`);
    console.log(`Access it at: http://localhost:${PORT}`);
    console.log(`--------------------------------------------------`);
});
