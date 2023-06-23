import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { CONFIG } from "../config.js";
import fetch from "node-fetch";
import fs from "fs";

const { requiredParamsCommand } = CONFIG;

const { location, accountId, permission, apiKey, fileUploadedPath } = CONFIG;

export async function callAccessTokenAPI() {
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

export const getYargsConfig = () => {
  const argv = yargs(hideBin(process.argv));

  for (const paramName in requiredParamsCommand) {
    if (requiredParamsCommand.hasOwnProperty(paramName)) {
      const paramConfig = requiredParamsCommand[paramName];
      argv.option(paramName, paramConfig);
    }
  }

  return { argsCommand: argv.argv };
};

export const checkUploadLimit = async () => {
  const token = await callAccessTokenAPI();

  const url = `https://api.videoindexer.ai/${location}/accounts/${accountId}`;
  const queryString = `includeUsage=true&includeAmsInfo=true&includeStatistics=true`;

  const headers = {
    "Cache-Control": "no-cache",
    "Ocp-Apim-Subscription-Key": apiKey,
    Authorization: `Bearer ${token}`,
  };

  const requestOptions = {
    method: "GET",
    headers,
  };

  try {
    const response = await fetch(`${url}?${queryString}`, requestOptions);
    const data = await response.json();
    const timeUsed = data.quotaUsage.everUploadDurationInSeconds / 60;
    const timeRemain =
      data.quotaUsage.everUploadDurationLimitInSeconds / 60 -
      data.quotaUsage.everUploadDurationInSeconds / 60;
    console.log(`Thời gian còn lại:`, timeRemain, "phút");
    console.log(`Thời gian đã sử dụng:`, timeUsed, "phút");

    return data;
  } catch (error) {
    console.log("Error:", error);
  }
};

const checkVideoIndex = async (token, videoId) => {
  return new Promise(async (resolve, reject) => {
    const url = `https://api.videoindexer.ai/${location}/accounts/${accountId}/Videos/${videoId}/Index`;
    const queryString = `language=af-ZA&reTranslate=false&includeStreamingUrls=false&includeSummarizedInsights=false`;

    const headers = {
      "Cache-Control": "no-cache",
      "Ocp-Apim-Subscription-Key": apiKey,
      Authorization: `Bearer ${token}`,
    };

    const requestOptions = {
      method: "GET",
      headers,
    };

    try {
      const response = await fetch(`${url}?${queryString}`, requestOptions);
      const data = await response.json();
      const { name, videos } = data;
      const progress = videos[0].processingProgress;
      console.log(`Video ${name} đang được xử lí:`, progress);
      resolve(data);
    } catch (error) {
      console.log("Error:", error);
      reject(error);
    }
  });
};
export const checkStatusUpload = async () => {
  const token = await callAccessTokenAPI();
  // Đọc danh sách video từ tệp txt và tải xuống với giới hạn đồng thời
  fs.readFile(fileUploadedPath, "utf8", async (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return;
    }

    const nonEmptyLines = data.split("\n").filter((line) => line.trim() !== "");

    const videoList = nonEmptyLines.map((line) => line.split("|"));
    for (let i = 0; i < videoList.length; i++) {
      const [videoId] = videoList[i];
      await checkVideoIndex(token, videoId);
    }
  });
};
