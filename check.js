import { checkUploadLimit, checkStatusUpload } from "./helpers/index.js";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Sử dụng node check info hoặc node check status-upload");
}
switch (args[0]) {
  case "info":
    checkUploadLimit();
    break;
  case "status-upload":
    checkStatusUpload();
    break;

  default:
    console.log("Sử dụng node check info hoặc node check status-upload");
    break;
}
