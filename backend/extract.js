const fs = require('fs');
const pdf = require('pdf-parse');

const filePath = process.argv[2];
if (!filePath) {
    console.error('Usage: node extract.js <path-to-pdf>');
    process.exit(1);
}

let dataBuffer = fs.readFileSync(filePath);

pdf.PDFParse(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(function(error){
    console.error('Error parsing PDF:', error);
});
