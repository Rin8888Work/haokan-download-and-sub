import fs from "fs";
import axios from "axios";
import util from "util";
const appendFilePromise = util.promisify(fs.appendFile);
const readFilePromise = util.promisify(fs.readFile);

async function translateTitle(currentTitle) {
  try {
    const response = await axios.get(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${currentTitle}`
    );
    return response.data[0][0][0];
  } catch (error) {
    console.error("Lỗi khi gọi dịch tiêu đề:", error);
    return null;
  }
}

async function writeToFile(filePath, url, currentTitle) {
  try {
    const content = url + "|" + currentTitle + "\n";
    console.log({ url });
    await appendFilePromise(filePath, content, "utf-8");
  } catch (err) {
    console.error("Lỗi khi ghi file:", err);
  }
}

async function callAPI(url) {
  try {
    const response = await axios.get(url);
    const clarityUrl = response.data.data.apiData.curVideoMeta.clarityUrl;

    // Sắp xếp mảng clarityUrl theo thứ tự "sc", "hd", "sd"
    clarityUrl.sort((a, b) => {
      if (a.key === "sc") return -1;
      if (b.key === "sc") return 1;
      if (a.key === "hd") return -1;
      if (b.key === "hd") return 1;
      if (a.key === "sd") return -1;
      if (b.key === "sd") return 1;
      return 0;
    });

    const playUrl = clarityUrl.find(
      (e) => e.key === "sc" || e.key === "hd" || e.key === "sd"
    ).url;

    const title = response.data.data.apiData.curVideoMeta.title;
    const currentTitle = await translateTitle(title);
    await writeToFile("tempdata/haokan/videos.txt", playUrl, currentTitle);
  } catch (error) {
    console.error("Lỗi khi gọi API:", error, url);
  }
}

export async function getLinkHaokan(filePath, qty) {
  return new Promise(async (resolve, reject) => {
    try {
      let i = 0;
      const data = await readFilePromise(filePath, "utf-8");
      const urls = data.split("\n");

      for (let url of urls) {
        if (qty === 0 || i < qty) {
          console.log(`Đang lấy link video ${i + 1}`);
          url = url.trim();
          if (url !== "") {
            await callAPI(url);
          }
          i++;
        }
      }
      resolve(true);
    } catch (err) {
      console.error();
      reject(`Lỗi khi đọc file: ${err}`);
    }
  });
}
