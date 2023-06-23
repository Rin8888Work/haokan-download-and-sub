import fs from "fs-extra";
import fetch from "node-fetch";
import path from "path";
import async from "async";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const maxConcurrentDownloads = 10;
const filePath = "D:\\genlogin\\download\\output.txt";
const reset = "\x1b[0m";
const red = "\x1b[31m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";

function sanitizeFilename(filename) {
  // Loại bỏ các kí tự không hợp lệ trong tên file
  const invalidChars = /[\/?*:|<>"]/g;
  const sanitizedFilename = filename.replace(invalidChars, "");

  return sanitizedFilename;
}

async function downloadFile(url) {
  try {
    const response = await fetch(url.href);

    if (!response.ok) {
      throw new Error(
        `${red}Lỗi khi tải về từ URL ${green} ${url.href}${reset}: ${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("video")) {
      throw new Error(`${red}URL ${url.href}${reset} không phải là tệp video.`);
    }
    const segments = url.href.split("/");
    const fileName = sanitizeFilename(`${segments[3]}-${url.title}`);
    const savePath = path.join(__dirname, "downloads", fileName + ".mp4");

    const writer = fs.createWriteStream(savePath);
    const stream = response.body.pipe(writer);

    return new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });
  } catch (error) {
    console.error(
      `${red}Lỗi khi tải về từ URL: ${green} ${url.href}:${reset}`,
      error.message
    );
    throw error;
  }
}

async function downloadFilesFromUrls() {
  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    let urls = fileContent.split(/\r?\n/);

    const pool = async.queue(async (url, callback) => {
      try {
        if (!url.href) {
          throw new Error(
            `${yellow}Không tìm thấy URL video trong trang HTML.`
          );
        }

        await downloadFile(url);
        console.log(`${green}Tải về thành công từ URL${reset}: ${url.href}`);
        urls = urls.filter((line) => line.includes(url.title));
        const updatedFileContent = urls.join("\n");
        await fs.writeFile(filePath, updatedFileContent, "utf-8");
        callback;
      } catch (error) {
        console.error(
          `${red}Lỗi khi tải về từ URL:${green} ${url.href}:${yellow}:`,
          error.message
        );
        callback;
      }
    }, maxConcurrentDownloads);

    urls.forEach((url) => {
      const [href, title] = url.split("|");

      pool.push({ href: href.trim(), title });
    });

    await new Promise((resolve, reject) => {
      pool.drain(() => {
        if (pool.length() === 0) {
          resolve();
        }
      });

      pool.error((error) => {
        reject(error);
      });
    });

    console.log("Hoàn thành tải về các tệp tin video.");
  } catch (error) {
    console.error(`${red}Lỗi:${yellow}`, error.message);
  }
}

downloadFilesFromUrls();
