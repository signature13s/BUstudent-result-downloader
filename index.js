const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const { PDFDocument } = require("pdf-lib");
const fs = require("fs").promises;
const path = require("path");
const base64 = require("base64-js");

const app = express();
const port = 3000;

const url =
  "https://exam.bujhansi.ac.in/frmViewCampusCurrentResult.aspx?cd=MwA3ADkA";
const headers = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8",
  Referer: url,
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Fetch initial page and extract courses
async function getCourses() {
  let responseText;
  const srcPath = "./src_page.html";
  try {
    if (
      await fs
        .access(srcPath)
        .then(() => true)
        .catch(() => false)
    ) {
      responseText = await fs.readFile(srcPath, "utf8");
    } else {
      const response = await axios.get(url, { headers, timeout: 10000 });
      responseText = response.data;
      await fs.writeFile(srcPath, responseText);
    }

    const $ = cheerio.load(responseText);
    const courses = {};
    const resultTypes = { Main: "", "Special Back": "6" };

    $("#ddlCourse option").each((i, option) => {
      if (i > 0) {
        // Skip '-Select-'
        const value = $(option).attr("value");
        const text = $(option).text().trim();
        courses[text] = value;
      }
    });

    return { courses, resultTypes };
  } catch (error) {
    console.error("Error fetching courses:", error.message);
    throw error;
  }
}

// Main function to process results
async function processResults(
  rollno_from,
  rollno_to,
  ddlCourse,
  course_name,
  result_type
) {
  const outputDir = `./${course_name}_results`;
  await fs.mkdir(outputDir, { recursive: true });

  let responseText;
  const srcPath = "./src_page.html";
  if (
    await fs
      .access(srcPath)
      .then(() => true)
      .catch(() => false)
  ) {
    responseText = await fs.readFile(srcPath, "utf8");
  } else {
    const response = await axios.get(url, { headers, timeout: 10000 });
    responseText = response.data;
    await fs.writeFile(srcPath, responseText);
  }

  const $ = cheerio.load(responseText);
  const viewstate = $('input[name="__VIEWSTATE"]').val() || "";
  const viewstategen = $('input[name="__VIEWSTATEGENERATOR"]').val() || "";
  const eventvalidation = $('input[name="__EVENTVALIDATION"]').val() || "";

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const css = `
        @page { 
            size: A4 landscape;
            margin: 20px; 
        }
        body { 
            word-wrap: break-word;
            overflow-wrap: break-word; 
            font-size: 12px;
        }
        img { 
            max-width: 100%; 
            display: block; 
            margin: 10px auto; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse;
        }
        td, th { 
            padding: 5px; 
            border: 1px solid #ddd; 
        }
    `;

  for (let i = parseInt(rollno_from); i <= parseInt(rollno_to); i++) {
    const payload = {
      __VIEWSTATE: viewstate,
      __VIEWSTATEGENERATOR: viewstategen,
      __EVENTVALIDATION: eventvalidation,
      txtUniqueID: i.toString(),
      ddlCourse: ddlCourse,
      ddlResultType: result_type,
      btnGetResult: "View Result",
    };

    try {
      const response = await axios.post(url, new URLSearchParams(payload), {
        headers,
        timeout: 10000,
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const $result = cheerio.load(response.data);
      if ($result("body").text().includes("NAME OF FATHER")) {
        // Handle images
        const imgPromises = $result("img")
          .map(async (index, img) => {
            let imgSrc = $(img).attr("src");
            if (imgSrc && !imgSrc.startsWith("http")) {
              imgSrc = `https://exam.bujhansi.ac.in/${imgSrc}`;
            }
            if (imgSrc) {
              const imgResponse = await axios.get(imgSrc, {
                responseType: "arraybuffer",
                timeout: 10000,
              });
              const imgBase64 = base64.fromByteArray(
                new Uint8Array(imgResponse.data)
              );
              const imgFormat =
                imgResponse.headers["content-type"].split("/")[1];
              $(img).attr("src", `data:image/${imgFormat};base64,${imgBase64}`);
            }
          })
          .get();

        await Promise.all(imgPromises);

        const htmlContent = $result.html();
        await page.setContent(htmlContent);
        await page.addStyleTag({ content: css });

        const pdfPath = path.join(outputDir, `result_${i}.pdf`);
        await page.pdf({
          path: pdfPath,
          format: "A4",
          landscape: true,
          margin: { top: "20px", right: "20px", bottom: "20px", left: "20px" },
        });

        console.log(`PDF saved as result_${i}.pdf in ${outputDir}`);
      }
    } catch (error) {
      console.error(`Error processing roll number ${i}:`, error.message);
    }
  }

  await browser.close();

  // Merge PDFs
  const pdfFiles = (await fs.readdir(outputDir))
    .filter((f) => f.endsWith(".pdf"))
    .sort(
      (a, b) =>
        parseInt(a.split("_")[1].split(".")[0]) -
        parseInt(b.split("_")[1].split(".")[0])
    );

  if (pdfFiles.length === 0) {
    console.log("No PDFs generated to merge.");
    return;
  }

  const mergedPdf = await PDFDocument.create();
  for (const pdfFile of pdfFiles) {
    const pdfBytes = await fs.readFile(path.join(outputDir, pdfFile));
    const pdf = await PDFDocument.load(pdfBytes);
    const pageIndices = pdf.getPageIndices(); // Corrected: Use getPageIndices()
    const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const outputPdfPath = `${course_name}_merged_results.pdf`;
  await fs.writeFile(outputPdfPath, await mergedPdf.save());
  console.log(`Merged PDF saved as ${outputPdfPath}`);

  // Optionally, clean up individual PDFs
  for (const pdfFile of pdfFiles) {
    await fs.unlink(path.join(outputDir, pdfFile));
  }
  console.log(`Cleaned up individual PDFs in ${outputDir}`);
}

// Serve the web interface
app.get("/", async (req, res) => {
  const { courses, resultTypes } = await getCourses();
  res.send(`
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Student's Result Downloader</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body { font-family: Helvetica, sans-serif; background-color: #f0f2f5; }
                    .container { max-width: 900px; margin: auto; padding: 20px; }
                </style>
            </head>
            <body class="flex items-center justify-center min-h-screen">
                <div class="container bg-white p-8 rounded-lg shadow-lg">
                    <h1 class="text-2xl font-bold mb-6 text-center">Student's Result Downloader</h1>
                    <form id="resultForm" method="POST">
                        <div class="mb-4 flex items-center">
                            <label for="rollFrom" class="w-1/4">Roll Number:</label>
                            <input type="text" id="rollFrom" name="rollFrom" class="w-1/3 p-2 border rounded" required>
                            <span class="mx-2">to</span>
                            <input type="text" id="rollTo" name="rollTo" class="w-1/3 p-2 border rounded" required>
                        </div>
                        <div class="mb-4 flex items-center">
                            <label for="resultType" class="w-1/4">Result Type:</label>
                            <select id="resultType" name="resultType" class="w-2/3 p-2 border rounded">
                                ${Object.keys(resultTypes)
                                  .map(
                                    (type) =>
                                      `<option value="${resultTypes[type]}">${type}</option>`
                                  )
                                  .join("")}
                            </select>
                        </div>
                        <div class="mb-4 flex items-center">
                            <label for="course" class="w-1/4">Course:</label>
                            <select id="course" name="course" class="w-2/3 p-2 border rounded">
                                ${Object.keys(courses)
                                  .map(
                                    (c) =>
                                      `<option value="${courses[c]}">${c}</option>`
                                  )
                                  .join("")}
                            </select>
                        </div>
                        <button type="submit" class="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Download Results</button>
                    </form>
                </div>
                <script>
                    document.getElementById('resultForm').addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        const data = {
                            rollFrom: formData.get('rollFrom'),
                            rollTo: formData.get('rollTo'),
                            resultType: formData.get('resultType'),
                            course: formData.get('course'),
                            courseName: document.querySelector('#course option:checked').textContent,
                        };
                        if (!data.rollFrom.trim()) {
                            alert('Roll number cannot be empty!');
                            return;
                        }
                        try {
                            await fetch('/download', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data),
                            });
                            alert('Download started. You can close the window. (Background download is supported)');
                        } catch (error) {
                            alert('Error starting download: ' + error.message);
                        }
                    });
                </script>
            </body>
        </html>
    `);
});

// Handle form submission
app.post("/download", async (req, res) => {
  const { rollFrom, rollTo, resultType, course, courseName } = req.body;
  res.status(200).send("Download started");
  // Run in background
  setImmediate(() =>
    processResults(rollFrom, rollTo, course, courseName, resultType).catch(
      console.error
    )
  );
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
