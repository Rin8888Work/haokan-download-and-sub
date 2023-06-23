import axios from "axios";
import fs from "fs";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { spawn } from "child_process";

import { CONFIG } from "./config.js";
import { callAccessTokenAPI } from "./helpers/index.js";

const {
  language,
  location,
  fileUploadedPath: filePath,
  colors,
  accountId,
  speechKey,
  speechLocation,
  maxConcurrentDownloads,
  bgSound,
  bgSoundDuration,
  volumnBgSound,
  tempHaokan,
  tempIxigua,
} = CONFIG;
const { green, red, reset, yellow } = colors;

// Số lượng video tải xuống đồng thời

function estimateAudioDuration(wordCount, averageReadingSpeed = 3) {
  const secondsPerWord = 1 / averageReadingSpeed;
  const estimatedDuration = wordCount * secondsPerWord;
  return estimatedDuration;
}

function convertTimeToSeconds(time) {
  const parts = time.split(":");
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const seconds = parseFloat(parts[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

function getMP3Duration(filePath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);

    let duration = 0;

    ffprobe.stdout.on("data", (data) => {
      duration += parseFloat(data.toString());
    });

    ffprobe.stderr.on("data", (data) => {
      reject(data.toString());
    });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        resolve({ duration });
      } else {
        reject(`ffprobe process exited with code ${code}`);
      }
    });
  });
}

async function getVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,duration,nb_frames",
      "-of",
      "default=nokey=1:noprint_wrappers=1",
      filePath,
    ];

    const process = spawn("ffprobe", args);

    let duration = null;
    let frameCount = null;
    let width = null;
    let height = null;
    process.stdout.on("data", (data) => {
      const dataParse = data.toString().trim().split("\n");
      duration = parseFloat(dataParse[2]);
      frameCount = parseInt(dataParse[3]);
      width = parseInt(dataParse[0]);
      height = parseInt(dataParse[1]);
    });

    process.on("error", (err) => {
      reject(err);
    });

    process.on("exit", (code) => {
      if (duration === null) {
        reject(new Error(`Failed to get duration for ${filePath}`));
      } else {
        resolve({ duration, frameCount, width, height });
      }
    });
  });
}

async function generateAnswer(question) {
  const completions = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: question,
    temperature: 0.2,
    n: 1,
    stop: "\n",
    stream: false,
  });

  console.log({ completions: completions.data.choices[0].text });
  const answer = completions.data.choices[0].text.trim();
  return answer;
}

async function summarizeText(sentences, videoDuration) {
  const question = `thử rút gọn dữ liệu này xuống còn ${videoDuration}s theo tốc độ đọc bình thường của en-US-AriaNeural \n sentences:${JSON.stringify(
    sentences
  ).replaceAll('"', "'")}`;
  const summary = await generateAnswer(question);

  return summary;
}

// Hàm tải xuống video caption
async function downloadVideoCaption(
  videoId,
  videoName,
  index,
  accessToken,
  tempPath
) {
  try {
    // Kiểm tra xem video đã tồn tại trong thư mục tải xuống chưa
    const captionPath = `${tempPath}/${videoName}.srt`;

    if (fs.existsSync(captionPath)) {
      console.log(
        `${yellow} Video caption already exists: ${green}${videoName}`
      );
      return;
    }

    // Gửi yêu cầu để lấy URL tải xuống video caption
    const response = await axios.get(
      `https://api.videoindexer.ai/${location}/Accounts/${accountId}/Videos/${videoId}/Captions?format=Srt&language=${language}&includeAudioEffects=false&includeSpeakers=false&accessToken=${accessToken}`
    );

    // Kiểm tra xem yêu cầu thành công
    if (response.status === 200) {
      const srtContent = response.data;

      // Tạo đường dẫn đầy đủ cho video đích
      const destinationPath = captionPath;

      // Lưu nội dung srt vào tệp
      fs.writeFileSync(destinationPath, srtContent);
      console.log(`Downloaded video caption: ${videoName}`);

      // Tạo âm thanh từ file SRT
      await createAudioFromSRT(videoName, tempPath);
    } else {
      console.log(`Failed to get caption for video: ${videoName}`);
    }
  } catch (error) {
    console.log(`Error downloading video captions: ${videoName}`, error);
  }
}

// Hàm tải xuống video
async function downloadVideo(videoId, videoName, index, accessToken, tempPath) {
  try {
    // Kiểm tra xem video đã tồn tại trong thư mục tải xuống chưa
    const videoPath = `${tempPath}/${videoName}.mp4`;

    if (fs.existsSync(videoPath)) {
      console.log(`${yellow} Video already exists: ${green} ${videoName}`);
      await downloadVideoCaption(
        videoId,
        videoName,
        index,
        accessToken,
        tempPath
      );
      return;
    }

    // Gửi yêu cầu để lấy URL tải xuống video
    const response = await axios.get(
      `https://api.videoindexer.ai/${location}/Accounts/${accountId}/Videos/${videoId}/SourceFile/DownloadUrl?accessToken=${accessToken}`
    );

    // Kiểm tra xem yêu cầu thành công
    if (response.status === 200) {
      const downloadUrl = response.data;

      // Tạo đường dẫn đầy đủ cho video đích
      const destinationPath = videoPath;

      // Tải xuống video và lưu vào thư mục đích
      const videoResponse = await axios({
        url: downloadUrl,
        method: "GET",
        responseType: "stream",
      });
      videoResponse.data.pipe(fs.createWriteStream(destinationPath));

      console.log(`Downloaded video: ${videoName}`);
      await downloadVideoCaption(
        videoId,
        videoName,
        index,
        accessToken,
        tempPath
      );
    } else {
      console.log(`Failed to get download URL for video: ${videoName}`);
    }
  } catch (error) {
    console.log(`Error downloading video: ${videoName}`, error);
  }
}

// Hàm xóa dòng từ tệp txt dựa trên videoId
function removeLineFromFile(filePath, videoName, downloadFolder, tempPath) {
  const fileData = fs.readFileSync(filePath, "utf8").split("\n");
  const updatedFileData = fileData.filter((line) => {
    const [, , linevideoName] = line.split("|");
    return linevideoName !== videoName;
  });
  fs.writeFileSync(filePath, updatedFileData.join("\n"));

  const fileToDeletePaths = [
    `${tempPath}/${videoName}.mp4`,
    `${tempPath}/${videoName}.srt`,
    `${tempPath}/${videoName}.wav`,
    `${downloadFolder}/output_${videoName}.wav`,
  ];
  fileToDeletePaths.forEach((filePath) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(`Error deleting file ${filePath}:`, err);
      }
    });
  });
}

// Hàm tạo âm thanh từ file SRT
// Hàm tạo âm thanh từ file SRT
async function createAudioFromSRT(videoName, tempPath) {
  try {
    const srtPath = `${tempPath}/${videoName}.srt`;
    const audioPath = `${tempPath}/${videoName}.wav`;

    // Kiểm tra xem âm thanh đã tồn tại hay chưa
    if (fs.existsSync(audioPath)) {
      console.log(`${yellow} Audio already exists: ${green}${videoName}`);
      return;
    }
    // Đọc nội dung của tệp SRT
    const srtContent = fs.readFileSync(srtPath, "utf8");
    // const lines = srtContent.split("\n");

    // for (let i = 0; i < lines.length; i += 4) {
    //   const start = lines[i + 1].split(" --> ")[0];
    //   const end = lines[i + 1].split(" --> ")[1];
    //   const text = lines[i + 2].trim();

    //   const startTime = timeToMilliseconds(start);
    //   const endTime = timeToMilliseconds(end);
    //   const duration = endTime - startTime;

    //   const speechRate = calculateSpeechRate(duration);
    //   console.log({ text, speechRate, duration });
    //   // setTimeout(() => {
    //   //   convertTextToSpeech(text, audioPath, speechRate);
    //   // }, startTime);
    // }

    // Tạo danh sách câu từ tệp SRT
    const sentences = srtContent
      .replace(/\r\n/g, "\n")
      .split("\n\n")
      .map((block) => {
        return block.split("\n").slice(2).join(" ");
      })
      .join(" ")
      .split(".")
      .filter((line) => line != "")
      .map((line) => line.trim() + ". ");

    // return false;
    // Tạo âm thanh từ danh sách câu
    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(audioPath);
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      speechKey,
      speechLocation
    );

    // Đặt giọng đọc
    speechConfig.speechSynthesisVoiceName = "en-US-AriaNeural"; // Giọng đọc mặc định, bạn có thể thay đổi giọng đọc tại đây

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
    const sentenceParts = [];
    let currentPart = "";
    const minPartSeconds = 10; // Thời lượng tối thiểu cho mỗi phần câu (tính bằng giây)

    for (let i = 0; i < sentences.length; i++) {
      currentPart += sentences[i];

      const durationPart = estimateAudioDuration(currentPart.split(" ").length);

      if (durationPart >= minPartSeconds) {
        sentenceParts.push(currentPart.trim().replaceAll(".", ","));
        currentPart = "";
      }
    }

    // Tạo một Promise để đợi việc tạo âm thanh hoàn thành
    const synthesisPromises = sentenceParts.map((part, i) => {
      return new Promise((resolve, reject) => {
        synthesizer.speakTextAsync(
          part,
          (result) => {
            if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
              console.log(
                `${yellow}Đang tạo âm thanh ${i + 1} cho ${videoName}${reset}`
              );
              resolve();
            } else {
              console.log(
                `${red}Lỗi khi tạo âm thanh ${i + 1} cho ${videoName}${reset}`,
                result.errorDetails
              );
              reject();
            }
          },
          (error) => {
            console.error(
              `Error synthesizing audio for sentence ${i + 1}: ${error}`
            );
            reject();
          }
        );
      });
    });

    // Chờ đợi việc tạo âm thanh hoàn thành
    await Promise.all(synthesisPromises);

    synthesizer.close();
    console.log(`${green}Tạo thành công audio cho video: ${videoName}`);
  } catch (error) {
    console.error(`Error creating audio for video: ${videoName}`, error);
  }
}

function timeToMilliseconds(timeString) {
  const parts = timeString.split(":");
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const seconds = parseFloat(parts[2].replace(",", "."));
  return (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
}

function calculateSpeechRate(duration) {
  // Tùy chỉnh các giá trị tốc độ đọc tại đây
  const minSpeechRate = 0.5; // Tốc độ đọc tối thiểu
  const maxSpeechRate = 2.0; // Tốc độ đọc tối đa
  const minDuration = 1000; // Thời gian tối thiểu (miligiây) để đảm bảo tốc độ không quá nhanh
  const maxDuration = 10000; // Thời gian tối đa (miligiây) để đảm bảo tốc độ không quá chậm

  // Tính toán tốc độ đọc dựa trên duration
  let speechRate = 1.0;
  if (duration < minDuration) {
    speechRate = maxSpeechRate;
  } else if (duration > maxDuration) {
    speechRate = minSpeechRate;
  } else {
    const durationRatio =
      (duration - minDuration) / (maxDuration - minDuration);
    speechRate =
      minSpeechRate + (maxSpeechRate - minSpeechRate) * durationRatio;
  }

  return speechRate;
}

async function editVideo(videoName) {
  return new Promise(async (resolve, reject) => {
    try {
      const inputPath = `${downloadFolder}/${videoName}.mp4`;
      const audioPath = `${downloadFolder}/${videoName}.wav`;
      const audioOutputPath = `${subFolder}/output_${videoName}.wav`;
      const outputPath = `${subFolder}/${videoName}.mp4`;
      const { duration: videoDuration } = await getVideoDuration(inputPath);
      const { duration: audioDuration } = await getMP3Duration(audioPath);
      const speedRatio = audioDuration / videoDuration;

      // return false;

      const audioProcess = spawn("ffmpeg", [
        "-i",
        audioPath,
        "-filter_complex",
        "rubberband=pitch=1.2:tempo=1,asettb=tb=4",
        "-c:a",
        "pcm_s16le",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-y",

        audioOutputPath,
      ]);

      audioProcess.on("close", (code) => {
        if (code === 0) {
          console.log(`${yellow}Đang edit video ${videoName}`);
          const optionsBgSound =
            videoDuration > bgSoundDuration
              ? `,aloop=loop=-1:size=${videoDuration * 100000}`
              : `,atrim=end=${videoDuration}`;

          const ffmpegProcess = spawn("ffmpeg", [
            "-i",
            inputPath,
            "-i",
            audioOutputPath,
            "-i",
            bgSound,
            "-filter_complex",
            `[0:v]crop=ih*3/4:ih,split=2[bg][video];
             [video]crop=ih*3/4:ih*3.6/4:0:-300,scale=576:-1[video_scaled];
             [bg]crop=576:1024,boxblur=10:5[bg_blurred];
             [bg_blurred][video_scaled]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2[out];
             [1:a]atempo=${speedRatio}[speech_audio]; \
             [2:a]volume=0.7${optionsBgSound}[bg_audio]; \
             [bg_audio][speech_audio]amerge=inputs=2[audio_out]`,
            "-map",
            "[out]",
            "-map",
            "[audio_out]",
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-ac",
            "2",
            "-preset",
            "slow",
            "-y",
            outputPath,
          ]);

          ffmpegProcess.on("exit", (code) => {
            if (code === 0) {
              resolve(`Đã tạo video theo yêu cầu cho tệp: ${videoName}`);
            } else {
              reject(
                `Đã xảy ra lỗi khi tạo video theo yêu cầu cho tệp: ${videoName}`
              );
            }
          });

          ffmpegProcess.on("error", (error) => {
            console.log(error);

            reject(error);
          });
        } else {
          reject(new Error(`Failed to generate new audio. Exit code: ${code}`));
        }
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}

async function editVideoHaoKan(videoName, downloadFolder, tempPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const inputPath = `${tempPath}/${videoName}.mp4`;
      const audioPath = `${tempPath}/${videoName}.wav`;
      const audioOutputPath = `${downloadFolder}/output_${videoName}.wav`;
      const outputPath = `${downloadFolder}/${videoName}.mp4`;
      const { duration: videoDuration } = await getVideoDuration(inputPath);
      const { duration: audioDuration } = await getMP3Duration(audioPath);
      const speedRatio = audioDuration / videoDuration;

      const audioProcess = spawn("ffmpeg", [
        "-i",
        audioPath,
        "-filter_complex",
        "rubberband=pitch=1.2:tempo=1,asettb=tb=4",
        "-c:a",
        "pcm_s16le",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-y",
        audioOutputPath,
      ]);

      audioProcess.on("close", (code) => {
        if (code === 0) {
          const optionsBgSound =
            videoDuration > bgSoundDuration
              ? `,aloop=loop=-1:size=${videoDuration * 100000}`
              : `,atrim=end=${videoDuration}`;
          console.log(`${yellow} Đang edit video ${videoName}${reset}`);

          const ffmpegProcess = spawn("ffmpeg", [
            "-i",
            inputPath,
            "-i",
            audioOutputPath,
            "-i",
            bgSound,
            "-filter_complex",
            `[0:v]crop=ih*3/4:ih,split=2[bg][video];
             [video]crop=ih*3/4:ih*3.6/4:0:-300,scale=576:-1[video_scaled];
             [bg]scale=-1:1024,crop=576:1024,boxblur=10:5[bg_blurred];
             [bg_blurred][video_scaled]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2[out];
             [1:a]atempo=${speedRatio}[speech_audio]; \
             [2:a]volume=${volumnBgSound}${optionsBgSound}[bg_audio]; \
             [bg_audio][speech_audio]amerge=inputs=2[audio_out]`,
            "-map",
            "[out]",
            "-map",
            "[audio_out]",
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-ac",
            "2",
            "-preset",
            "slow",
            "-y",
            outputPath,
          ]);
          ffmpegProcess.on("exit", (code) => {
            if (code === 0) {
              resolve(`Đã tạo video theo yêu cầu cho tệp: ${videoName}`);
            } else {
              reject(
                `Đã xảy ra lỗi khi tạo video theo yêu cầu cho tệp: ${videoName}`
              );
            }
          });

          ffmpegProcess.on("error", (error) => {
            console.log(error);

            reject(error);
          });
        } else {
          reject(new Error(`Failed to generate new audio. Exit code: ${code}`));
        }
      });
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}

const createEditVideo = async (downloadFolder, tempPath) => {
  const videoFiles = fs.readdirSync(tempPath).filter((file) => {
    const extension = file.split(".").pop();
    return extension === "mp4";
  });

  for (let i = 0; i < videoFiles.length; i++) {
    try {
      const videoFile = videoFiles[i];
      const videoName = videoFile.split(".").shift();

      // Kiểm tra xem video đã tồn tại hay chưa
      const editedPath = `${downloadFolder}/${videoName}.mp4`;
      if (!fs.existsSync(editedPath)) {
        const isEdited = await editVideoHaoKan(
          videoName,
          downloadFolder,
          tempPath
        );
        if (isEdited) {
          console.log(`${green} ${videoName} đã được edit`);
          removeLineFromFile(filePath, videoName, downloadFolder, tempPath);
        }
      } else {
        console.log(`${green} ${videoName} đã được edit trước đó`);
        removeLineFromFile(filePath, videoName, downloadFolder, tempPath);
      }
    } catch {
      console.log(`Edit has been fail.`);
      continue;
    }
  }
};

export const downloadVideos = async (qty, outputPath, sourceVideo) => {
  const downloadFolder = outputPath;

  let tempPath = "";
  switch (sourceVideo) {
    case "haokan":
      tempPath = `${tempHaokan}`;
      break;
    case "ixigua":
      tempPath = `${tempIxigua}`;
      break;

    default:
      break;
  }

  // Đọc danh sách video từ tệp txt và tải xuống với giới hạn đồng thời
  fs.readFile(filePath, "utf8", async (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return;
    }

    const accessToken = await callAccessTokenAPI();

    const nonEmptyLines = data.split("\n").filter((line) => line.trim() !== "");

    const videoList = nonEmptyLines.map((line) => line.split("|"));
    const downloadPromises = [];
    let downloadCount = 0;
    const count = qty === 0 ? videoList.length : qty;
    for (let i = 0; i < count; i++) {
      const [videoId, videoTitle, videoName] = videoList[i];
      const downloadPromise = downloadVideo(
        videoId,
        videoName.trim(),
        i,
        accessToken,
        tempPath
      );
      downloadPromises.push(downloadPromise);
      downloadCount++;

      if (downloadCount === maxConcurrentDownloads) {
        // Chờ cho đến khi tất cả các video hiện tại được tải xuống xong
        await Promise.all(downloadPromises);
        downloadPromises.length = 0; // Xóa mảng để chuẩn bị cho video tiếp theo
        downloadCount = 0;
      }
    }

    // Chờ cho đến khi tất cả các video còn lại được tải xuống xong
    await Promise.all(downloadPromises);

    // Kiểm tra xem các tệp SRT trong thư mục tải xuống đã được tạo âm thanh chưa
    const srtFiles = fs.readdirSync(tempPath).filter((file) => {
      const extension = file.split(".").pop();
      return extension === "srt";
    });

    for (let i = 0; i < srtFiles.length; i++) {
      const srtFile = srtFiles[i];
      const videoName = srtFile.split(".").shift();

      // Kiểm tra xem âm thanh đã tồn tại hay chưa
      const audioPath = `${tempPath}/${videoName}.wav`;
      if (!fs.existsSync(audioPath)) {
        await createAudioFromSRT(videoName, tempPath);
      }
    }
    await createEditVideo(downloadFolder, tempPath);
  });
};
