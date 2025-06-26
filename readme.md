# 📄 Student Result Downloader

This is a Node.js application that automates the downloading of student result PDFs from [BU Jhansi Result Portal](https://exam.bujhansi.ac.in/frmViewCampusCurrentResult.aspx). It provides a simple web interface to input roll numbers, select course and result type, and then generates individual PDFs for each student result and merges them into a single PDF file.

## 🛠 Features

- 🔎 Auto fetch available courses and result types from the result portal
- 🧾 Generates individual result PDFs using Puppeteer
- 🗂 Merges all generated PDFs into one consolidated file
- 🧼 Optionally cleans up intermediate files
- 🌐 Simple and clean web interface using Tailwind CSS

## 🚀 Technologies Used

- [Express.js](https://expressjs.com/) – Web server
- [Axios](https://axios-http.com/) – HTTP requests
- [Cheerio](https://cheerio.js.org/) – HTML parsing (jQuery-like)
- [Puppeteer](https://pptr.dev/) – PDF generation from HTML
- [pdf-lib](https://pdf-lib.js.org/) – Merging PDFs
- [Tailwind CSS](https://tailwindcss.com/) – Frontend styling

---

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/signature13s/BUstudent-result-downloader.git
   cd student-result-downloader
   ```
   Install dependencies

```bash

npm install
```

Run the server

```bash
node index.js
```

Access the app

Open your browser and go to: http://localhost:3000

🌐 Usage
Open the web interface.

Enter the roll number range, select the result type and course.

Click Download Results.

The script will:

Scrape the results for each roll number.

Render each result to a PDF.

Merge all PDFs into a single file named: CourseName_merged_results.pdf.

Clean up individual PDFs.

📁 Output Structure

```bash
student-result-downloader/
│
├── index.js # Main server file
├── src_page.html # Cached source page (for performance)
├── COURSEName_results/ # Temporary individual PDFs auto cleaned after creation of merged pdf
├── COURSEName_merged_results.pdf# Final merged PDF
```

⚠️ Notes
Puppeteer Requirements:
Make sure your system or hosting environment has required dependencies for Puppeteer to run (e.g., on Ubuntu, install fonts-liberation, libnss3, etc.)

Legal Notice:
This tool is intended for educational and personal use. Do not use it for scraping private or sensitive data without permission.

🤝 Contributing
Feel free to fork and submit PRs to improve performance, error handling, or add new features like CAPTCHA bypassing or better UI.

```bash
👨‍💻 Author
Mukul Kumar Sahu
Department of C.S.E
Institute of Engineering and Technology, Bundelkhand University
```
