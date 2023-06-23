// index.js
import { getYargsConfig } from "./helpers/index.js";
import { CONFIG } from "./config.js";
import fs from "fs";
import { getLinkHaokan } from "./haokan.js";
import { uploadIndexerAzure } from "./uploadindexer.js";
import { downloadVideos } from "./download.js";

const bazoka = async () => {
  const { colors } = CONFIG;
  const { argsCommand } = getYargsConfig();

  const { sourceVideo, linkFilePath, outputFilePath, action, qty } =
    argsCommand;

  // Check input, output folder exits
  if (!fs.existsSync(linkFilePath)) {
    console.log(
      `${colors.red} Không tìm thấy file txt chứa link video: ${colors.green}linkFilePath:${linkFilePath}: `
    );
    return;
  }
  if (!fs.existsSync(outputFilePath)) {
    fs.mkdir(outputFilePath, { recursive: true }, (err) => {
      if (err) {
        console.error(`${colors.red}Lỗi khi tạo thư mục:${colors.reset}`, err);
      } else {
        console.log(
          `${colors.green}Thư mục đã được tạo thành công${colors.reset}`,
          outputFilePath
        );
      }
    });
  }
  // Check nguồn
  switch (sourceVideo) {
    case "haokan":
      switch (action) {
        case "upload":
          const isGetLinkSuccess = await getLinkHaokan(linkFilePath, qty ?? 0);
          console.log({ isGetLinkSuccess });
          if (isGetLinkSuccess) {
            await uploadIndexerAzure(sourceVideo, qty ?? 0);
          }
          return;
        case "download":
          await downloadVideos(qty, outputFilePath, sourceVideo);
          return;
        default:
          console.log(
            `${colors.red}Chọn action là upload hoặc download${colors.reset}`
          );
          return;
      }
      break;

    case "ixigua":
      console.log("Chưa hỗ trợ");
      return;

    default:
      console.log(
        `${colors.red}Chọn nguồn(sourceVideo) là ixigua hoặc haokan${colors.reset}`
      );
      return;
  }
  console.log({ sourceVideo, linkFilePath, outputFilePath, action });
};

bazoka();
