export const CONFIG = {
  // Cấu hình cơ bản
  maxConcurrentDownloads: 2, // giới hạn số video download cùng lúc
  uploadInterval: 10000, // Thời gian đợi để upload từng video: min 10 giây,
  fileUploadedPath: "fileUploaded.txt",
  bgSound: "nhacnen/original.mp3", //Đường dẫn nhạc nền
  bgSoundDuration: 356, // Thời lượng của nhạc nền tính bằng giây.
  volumnBgSound: 0.7,
  language: "English",

  // Cấu hình key
  speechKey: "404d785dbecf4b9e87464143b1aadbfa",
  accountId: "cc30e18d-495b-4ade-b60c-8110cb9641af",
  apiKey: "cdda6a20e4bc4567885f04181c125027",

  // Bên dưới không được thay đổi
  tempHaokan: `tempdata/haokan/videos`,
  tempIxigua: `tempdata/ixigua/videos`,
  haokanSegment: 3,
  ixiguaSegment: 3,
  speechLocation: "eastus",
  permission: "Contributor",
  location: "trial",
  colors: {
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    reset: "\x1b[0m",
  },
  requiredParamsCommand: {
    qty: {
      type: "number",
      demandOption: false,
      describe: "Nhập số lượng video cần edit: qty",
      errorMessage: "Nhập số lượng video cần edit: qty",
    },
    action: {
      type: "string",
      demandOption: true,
      describe:
        "Nhập các action theo thứ tự sau: ixigua có ['upload', 'download'], haokan có ['getlink', 'upload', 'download']",
      errorMessage:
        "Nhập các action theo thứ tự sau: ixigua có ['upload', 'download'], haokan có ['getlink', 'upload', 'download']: action",
    },
    linkFilePath: {
      type: "string",
      demandOption: true,
      describe: "Đường dẫn đến file txt chứa urls video",
      errorMessage: "Nhập Đường dẫn đến file txt chứa urls video: linkFilePath",
    },
    outputFilePath: {
      type: "string",
      demandOption: true,
      describe: "Đường dẫn đến folder chứa video khi xuất ra",
      errorMessage:
        "Nhập Đường dẫn đến folder chứa video khi xuất ra: outputFilePath",
    },
    sourceVideo: {
      type: "string",
      demandOption: true,
      describe: "Nguồn trang web lấy video: Support `ixigua`, `haokan`",
      errorMessage:
        "Nguồn trang web lấy video: Support `ixigua`, `haokan`: sourceVideo",
    },
  },
};
