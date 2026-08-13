const express = require('express');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

const app = express();
const PORT = 3005;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const dataPath = path.join(__dirname, '../data.json');
const templatePath = path.join(__dirname, '../src/template.html');
const outHtmlPath = path.join(__dirname, '../index.html');
const outJsPath = path.join(__dirname, '../js/works.js');

// Handlebars helpers
Handlebars.registerHelper('increment', function(value) {
    return parseInt(value) + 1;
});

app.get('/api/data', (req, res) => {
    try {
        const rawData = fs.readFileSync(dataPath, 'utf8');
        res.json(JSON.parse(rawData));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

app.post('/api/data', (req, res) => {
    try {
        fs.writeFileSync(dataPath, JSON.stringify(req.body, null, 2), 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to write data' });
    }
});

app.post('/api/build', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        // 1. Build index.html
        const templateSrc = fs.readFileSync(templatePath, 'utf8');
        const template = Handlebars.compile(templateSrc);
        const resultHtml = template(data);
        fs.writeFileSync(outHtmlPath, resultHtml, 'utf8');

        // 2. Build js/works.js
        const jsContent = `/* Portfolio items. Add, remove or reorder freely.
   img: path to the image  |  href: link (Behance project URL) */
window.WORKS = ${JSON.stringify(data.projects, null, 2)};
`;
        fs.writeFileSync(outJsPath, jsContent, 'utf8');

        res.json({ success: true, message: 'Site built successfully!' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to build site: ' + e.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Admin server running at http://localhost:${PORT}`);
    console.log(`Edit the site data, then click 'Export' to build static files.`);
});
