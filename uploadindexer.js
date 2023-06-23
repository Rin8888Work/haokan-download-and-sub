import fs from "fs-extra";
import fetch from "node-fetch";
import { CONFIG } from "./config.js";
const {
  location,
  fileUploadedPath,
  colors,
  accountId,
  permission,
  apiKey,
  uploadInterval,
  haokanSegment,
  ixiguaSegment,
} = CONFIG;
const { green, red, reset, yellow } = colors;

function sanitizeFilename(filename) {
  // Loại bỏ các kí tự không hợp lệ trong tên file
  const invalidChars = /[\/?*:|<>,'!"]/g;
  const sanitizedFilename = filename
    .trim()
    .replaceAll(invalidChars, "")
    .replaceAll(" ", "-");

  return sanitizedFilename;
}

async function callAccessTokenAPI() {
  const url = `https://api.videoindexer.ai/Auth/${location}/Accounts/${accountId}/AccessTokenWithPermission`;
  const queryString = `permission=${encodeURIComponent(permission)}`;

  const headers = {
    "Cache-Control": "no-cache",
    "Ocp-Apim-Subscription-Key": apiKey,
  };

  const requestOptions = {
    method: "GET",
    headers,
  };

  try {
    const response = await fetch(`${url}?${queryString}`, requestOptions);
    const data = await response.json();
    console.log("Lấy token thành công");

    return data;
  } catch (error) {
    console.log("Error:", error);
  }
}

async function upload(videoUrl, accessToken) {
  const indexerUrl = `https://api.videoindexer.ai/${location}/Accounts/${accountId}/Videos`;

  const params = {
    name: videoUrl.title,
    privacy: "Private",
    language: "multi",
    indexingPreset: "Default",
    streamingPreset: "Default",
    sendSuccessEmail: false,
    useManagedIdentityToDownloadVideo: false,
    accessToken,
    videoUrl: videoUrl.href,
  };

  const queryString = Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");

  const headers = {
    "Content-Type": "application/json",
    "Ocp-Apim-Subscription-Key": apiKey,
  };

  const requestOptions = {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  };

  try {
    const response = await fetch(
      `${indexerUrl}?${queryString}`,
      requestOptions
    );
    const data = await response.json();

    return new Promise((resolve, reject) => {
      if (data?.id) resolve({ id: data.id });
      else reject();
    });
  } catch (error) {
    console.log("Error:", error);
  }
}

export async function uploadIndexerAzure(sourceVideo, qty) {
  let segmentNum = 0;
  let filePath = "";
  let i = 0;
  switch (sourceVideo) {
    case "haokan":
      filePath = "tempdata/haokan/videos.txt";
      segmentNum = haokanSegment;
      break;
    case "ixigua":
      filePath = "tempdata/ixigua/videos.txt";
      segmentNum = ixiguaSegment;
      break;

    default:
      break;
  }

  try {
    const accessToken = await callAccessTokenAPI();

    const fileContent = await fs.readFile(filePath, "utf-8");
    const fileUploadedContent = await fs.readFile(fileUploadedPath, "utf-8");
    let urls = fileContent.split(/\r?\n/);
    let fileNameUploaded = fileUploadedContent.split(/\r?\n/);

    const uploadNext = async () => {
      if (urls.length === 0) {
        console.log("Hoàn thành upload các tệp tin video.");
        return;
      }

      const url = urls.shift();
      const [href, title] = url.split("|");
      const segments = href.split("/");
      console.log({ segments });
      const fileName = sanitizeFilename(`${segments[segmentNum]}-${title}`);
      try {
        if (!href) {
          throw new Error(`${yellow}Không tìm thấy URL video.`);
        }

        console.log(`${yellow}Đang upload: ${green} ${title}`);
        const { id: videoId } = await upload(
          { href, title: segments[segmentNum] },
          accessToken
        );

        console.log({ videoId });
        if (videoId) {
          console.log(`${green}Upload thành công video ${reset}: ${fileName}`);

          urls = urls.filter((line) => !line.includes(url));
          const updatedFileContent = urls.join("\n");
          await fs.writeFile(filePath, updatedFileContent, "utf-8");

          fileNameUploaded.push(`${videoId}|${title}|${fileName}`);
          const updatedFileUploadedContent = fileNameUploaded.join("\n");
          await fs.writeFile(
            fileUploadedPath,
            updatedFileUploadedContent,
            "utf-8"
          );
          i++;
        }
      } catch (error) {
        console.error(
          `${red}Lỗi khi upload video:${green} Id: ${href} ${title}:${yellow}:`,
          error
        );
        return;
      }
      if (qty === 0 || i < qty) setTimeout(uploadNext, uploadInterval); // Đợi 20 giây trước khi gọi upload tiếp theo
      console.log(`Đợi ${uploadInterval / 1000}s trước khi upload tiếp`);
    };

    uploadNext();
  } catch (error) {
    console.error(`${red}Lỗi:${yellow}`, error);
  }
}
