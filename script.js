/*
  HELPERS
*/
async function getFileFromEntry(fileEntry) {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });
}


function appendBuffer(buffer1, buffer2) {
  let tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
  return tmp.buffer;
}


/*
  FOLDER DRAG-N-DROP
  From https://stackoverflow.com/a/53058574
*/
// Drop handler function to get all files
async function getAllFileEntries(dataTransferItemList) {
  let fileEntries = [];
  // Use BFS to traverse entire directory/file structure
  let queue = [];
  // Unfortunately dataTransferItemList is not iterable i.e. no forEach
  for (let i = 0; i < dataTransferItemList.length; i++) {
    // Note webkitGetAsEntry a non-standard feature and may change
    // Usage is necessary for handling directories
    queue.push(dataTransferItemList[i].webkitGetAsEntry());
  }
  while (queue.length > 0) {
    let entry = queue.shift();
    if (entry.isFile) {
      fileEntries.push(entry);
    } else if (entry.isDirectory) {
      let reader = entry.createReader();
      queue.push(...await readAllDirectoryEntries(reader));
    }
  }
  return fileEntries;
}

// Get all the entries (files or sub-directories) in a directory by calling readEntries until it returns empty array
async function readAllDirectoryEntries(directoryReader) {
  let entries = [];
  let readEntries = await readEntriesPromise(directoryReader);
  while (readEntries.length > 0) {
    entries.push(...readEntries);
    readEntries = await readEntriesPromise(directoryReader);
  }
  return entries;
}

// Wrap readEntries in a promise to make working with readEntries easier
async function readEntriesPromise(directoryReader) {
  try {
    return await new Promise((resolve, reject) => {
      directoryReader.readEntries(resolve, reject);
    });
  } catch (err) {
    console.log(err);
  }
}


/*
  CHUNKS
*/
async function getTotalSize(fileEntries) {
  totalSize = 0;

  for (const fileEntry of fileEntries) {
    const file = await getFileFromEntry(fileEntry);
    totalSize += file.size;
  }

  return totalSize;
}


function readChunkFromFile(file, offset, chunkSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (event) {
      if (event.target.error) {
        reject(event.target.error);
        return;
      }

      const chunk = event.target.result;
      resolve(chunk);
    };

    const blob = file.slice(offset, offset + chunkSize);
    reader.readAsArrayBuffer(blob);
  });
}


async function readInChunks(fileEntries, chunkSize) {
  const itemsElement = document.getElementById("items");
  const totalSize = await getTotalSize(fileEntries);
  const totalChunks = Math.ceil(totalSize / chunkSize);
  let fileIndex = 0;
  let chunkIndex = 0;
  let offset = 0;
  const chunks = [];
  const files = [];
  let folderName;

  while (fileIndex < fileEntries.length) {
    const file = await getFileFromEntry(fileEntries[fileIndex]);
    const path = file.webkitRelativePath.split('/');
    files.push({ "length": file.size, "path": path.slice(1) });
    folderName = path[0];

    let chunk = undefined;

    while (offset < file.size) {
      if (chunks[chunkIndex]) {
        const tempChunkSize = chunkSize - chunks[chunkIndex].byteLength;
        chunk = await readChunkFromFile(file, offset, tempChunkSize);
        chunks[chunkIndex] = appendBuffer(chunks[chunkIndex], chunk);
        offset += tempChunkSize;
      } else {
        chunk = await readChunkFromFile(file, offset, chunkSize);
        chunks[chunkIndex] = chunk;
        offset += chunkSize;
      }
      // console.log(`CHUNK ${chunkIndex} size: ${chunks[chunkIndex].byteLength}/${chunkSize}`);

      chunkIndex += 1;
      itemsElement.textContent = `${chunkIndex}/${totalChunks} chunks`;
    }

    // Once it finishes reading the entire file...
    if (chunk.byteLength < chunkSize && fileIndex != fileEntries.length - 1) {
      // console.warn(`Chunk ${chunkIndex} still isn't filled`);
      // If the chunk still isn't filled, continue filling it with next file
      chunkIndex -= 1;
      offset = 0;
    }

    fileIndex += 1;
  }

  return [chunks, files, folderName];
}


/*
  TORRENT CREATION
*/
function bencode(data) {
  if (typeof data === "number") {
    return `i${data}e`;
  } else if (typeof data === "string") {
    const encoder = new TextEncoder();
    const encodedBytes = encoder.encode(data);
    return `${encodedBytes.length}:${data}`;
  } else if (Array.isArray(data)) {
    return `l${data.map(bencode).join('')}e`;
  } else if (typeof data === "object") {
    const keys = Object.keys(data).sort();
    const encodedPairs = keys.map(key => `${bencode(key)}${bencode(data[key])}`);
    return `d${encodedPairs.join('')}e`;
  }
}


function createTorrent(announce, filesKey, filesValue, nameValue, chunkSize, hashes, source) {
  const torrentData = {
    "announce": announce,
    "created by": "web",
    "creation date": Math.floor(new Date().getTime() / 1000),
    "info": {
      "entropy": Math.floor(Math.random() * 4e9) - 2e9,
      [filesKey]: filesValue,
      "name": nameValue,
      "piece length": chunkSize,
      "pieces": undefined,
      "private": 1,
      "source": source
    }
  };

  const bencoded = bencode(torrentData);
  const bencoded1 = bencoded.substring(0, bencoded.indexOf("6:pieces")) + `6:pieces${hashes.length * 20}:`;
  const bencoded2 = bencoded.substring(bencoded.indexOf("7:private"));

  const torrent = new Blob([bencoded1, ...hashes, bencoded2], { type: "application/x-bittorrent" });
  return torrent
}


async function getTorrent(fileEntries) {
  console.info(fileEntries);
  const itemsElement = document.getElementById("items");
  const totalSize = await getTotalSize(fileEntries);
  const chunkSize = 2 ** (Math.floor(Math.log2(totalSize / 1000)));
  document.getElementById("total_size").value = totalSize;
  document.getElementById("piece_length").value = chunkSize;
  const hashes = [];

  const [chunks, files, folderName] = await readInChunks(fileEntries, chunkSize);
  const totalChunks = chunks.length;
  let i = 0;

  while (i < totalChunks) {
    const hash = await crypto.subtle.digest("SHA-1", chunks[i]);
    i += 1;
    itemsElement.textContent = `${i}/${totalChunks} hashes`;
    hashes.push(new Uint8Array(hash));
  }
  itemsElement.textContent = ``;

  const announce = document.getElementById("announce").value;
  const source = document.getElementById("source").value;
  let filesKey;
  let filesValue;
  let nameValue;

  if (files.length === 1) {
    filesKey = "length";
    filesValue = files[0].length;
    nameValue = fileEntries[0].name;
  } else {
    filesKey = "files"
    filesValue = files;
    nameValue = folderName;
  }

  const blob = createTorrent(announce, filesKey, filesValue, nameValue, chunkSize, hashes, source);
  const filename = nameValue + ".torrent";

  const torrentFile = new File([blob], filename, { type: 'application/x-bittorrent' });
  const container = new DataTransfer();
  container.items.add(torrentFile);
  document.getElementById("file").files = container.files;

  const content = document.getElementById("content");
  for (const file of files) {
    content.innerHTML += file.path.join('/') + "<br>";
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.textContent = "Download";
  document.getElementById("items").append(link);
}


/*
  SCREENSHOTS
  Many thanks to greenprog
*/
function parseDuration(durString) {
  const regex = /^\s*Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/;
  const match = durString.match(regex);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return (parseInt(hours) * 60 * 60) + (parseInt(minutes) * 60) + parseInt(seconds);
}


function formatTimestamp(seconds) {
  const substring = seconds < 3600 ? 14 : seconds < 32400 ? 12 : 11;
  return new Date(seconds * 1000).toISOString().substring(substring, 19);
}


function generateTimestamps(duration, numScreenshots) {
  const minDistance = duration / numScreenshots / 2; // Spread SS's across; worst case: covers 50% of film
  const timestamps = [0]; // Store 0 so our first SS will be minDistance from the start
  let failSafe = 0;
  while (timestamps.length <= numScreenshots) {
    const newTS = Math.floor(Math.random() * (duration));
    if (!timestamps.some(ts => Math.abs(ts - newTS) < minDistance)) {
      timestamps.push(newTS);
    }
    if (failSafe > 1000) {
      break;
    }
  }
  timestamps.shift(); // Remove that 0:00 TS
  timestamps.sort((a, b) => a - b);
  return timestamps;
}


async function getScreenshots(fileEntries) {
  const box = document.getElementById("screenshots");
  const file = await getFileFromEntry(fileEntries[0]);  // TODO: Pick a file from multiple

  // Load ffmpeg
  const ffmpeg = new FFmpegWASM.FFmpeg();
  ffmpeg.on('log', ({ type, message }) => {
    console.log(`FFMPEG [${type}]: ${message}`);
  });
  await ffmpeg.load({
    coreURL: 'ffmpeg-core.js',
    wasmURL: 'ffmpeg-core.wasm',
  });
  await ffmpeg.createDir('/videos');
  await ffmpeg.mount('WORKERFS', { files: [file] }, '/videos');

  // Get duration
  const filepath = `/videos/${file.name}`;

  let duration = null;
  const logOutputCb = ({ type, message }) => {
    duration = parseDuration(message);
    if (duration) {
      ffmpeg.off('log', logOutputCb);
    }
  };
  ffmpeg.on('log', logOutputCb);
  await ffmpeg.exec([
    '-i', filepath,
    '-an',
    '-vn',
    '-sn',
    '-hide_banner',
  ]);
  ffmpeg.off('log', logOutputCb);

  // Take screenshots
  const numScreenshots = 8;
  const durationH = formatTimestamp(duration);
  const timestamps = generateTimestamps(duration, numScreenshots);
  box.innerHTML = "";

  console.info(`Video duration: ${durationH}. Generating 1 of ${numScreenshots} screenshots.`);
  let validScreenshots = 0;
  let blurryScreenshots = 0;
  let darkScreenshots = 0;
  let next = 1;
  let processed = 0;

  const blurryAlert = document.createElement('span');
  blurryAlert.textContent = "🌫️";

  for (const timestamp of timestamps) {
    const timestampH = formatTimestamp(timestamp);
    await ffmpeg.exec([
      '-ss', `${timestamp}`,
      '-i', filepath,
      '-an',
      '-sn',
      '-frames:v', '1',
      `screen_${timestamp}.png`
    ]);
    console.info(++next <= numScreenshots ? `Generated screenshot at ${timestampH}. Generating ${next} of ${numScreenshots} screenshots.`
      : `Generated ${numScreenshots} screenshots.`);

    const thumbData = await ffmpeg.readFile(`screen_${timestamp}.png`);
    const thumbBlob = new Blob([thumbData.buffer], { type: 'image/png' });
    // TODO: saveSS64(thumbBlob, timestampH);
    const objectURL = URL.createObjectURL(thumbBlob);

    const imgId = `outputImage_${timestampH}`;
    const imgWrap = document.createElement('div');
    imgWrap.className = 'screenshot';
    imgWrap.innerHTML = `<span class="ts">${timestampH}</span><input type="checkbox" id="selected_${timestampH}" />`;
    const imgElement = document.createElement('img');
    imgElement.id = imgId;
    imgElement.src = objectURL;
    imgElement.onload = () => {
      // Not always loading for some reason...
      if (typeof cv == 'undefined') {
        validScreenshots++;
        return;
      }
      const image = cv.imread(imgId);
      // Convert to grayscale for easier calculations
      const gray = new cv.Mat();
      cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY, 0);

      // Check darkness
      const meanIntensity = cv.mean(gray);
      const averageIntensity = meanIntensity[0];
      const isDark = averageIntensity < 50; // Threshold can be adjusted
      console.info(`Average intensity (brightness): ${averageIntensity}`);
      if (isDark) {
        darkScreenshots++;
        console.info('Dark image');
      }

      // Check blurriness
      const laplacian = new cv.Mat();
      cv.Laplacian(gray, laplacian, cv.CV_64F);
      const mean = new cv.Mat();
      const stddev = new cv.Mat();
      cv.meanStdDev(laplacian, mean, stddev);
      const variance = Math.pow(stddev.data64F[0], 2);
      const isBlurry = variance < 1000; // Threshold can be adjusted
      console.info(`Variance (blurriness): ${variance}`);
      if (isBlurry) {
        blurryScreenshots++;
        console.info('Blurry image');
        imgWrap.prepend(blurryAlert.cloneNode(true));
      }

      imgElement.title = `Intensity (brightness): ${averageIntensity}, variance (blurriness): ${variance}`
      if (!isBlurry && !isDark) {
        validScreenshots++;
      }
      if (++processed >= numScreenshots) {
        console.info(`Generated ${numScreenshots} screenshots: ${validScreenshots} clear, ${blurryScreenshots} blurry, ${darkScreenshots} dark`);
      }
      // Clean up
      image.delete();
      gray.delete();
      laplacian.delete();
      mean.delete();
      stddev.delete();
    };
    const ssOutput = document.getElementById('screenshots');
    ssOutput
      .appendChild(imgWrap)
      .appendChild(imgElement);
  }
}


/*
  MEDIAINFO
*/
async function getMediaInfo(fileEntries) {
  const file = await getFileFromEntry(fileEntries[0]);  // TODO: Pick a file from multiple
  const mediaInfoConfig = { format: "text" };

  MediaInfo(mediaInfoConfig, (mediainfo) => {
    const readChunk = (chunkSize, offset) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (event) => {
          if (event.target.error) {
            reject(event.target.error)
          } else {
            resolve(new Uint8Array(event.target.result));
          }
        }
        reader.readAsArrayBuffer(file.slice(offset, offset + chunkSize))
      });

    mediainfo.analyzeData(() => file.size, readChunk)
      .then((result) => {
        // From ANT: Alas, it doesn't include this field?!
        if (!result.toLowerCase().includes("complete name")) {
          result = result.replace(/^General/, "General\nComplete name                            : " + file.name);
        }
        document.getElementById("mediainfo").textContent = result;
      })
  }
  );
}


/*
  MAIN
*/
function clear() {
  document.getElementById("file").value = '';
  document.getElementById("total_size").value = 0;
  document.getElementById("piece_length").value = 0;
  ["items", "screenshots", "mediainfo"].forEach(id => document.getElementById(id).innerHTML = "");
}

async function main() {
  const dropzone = document.getElementById("dropzone");
  clear();

  dropzone.addEventListener("dragover", function (event) {
    event.preventDefault();
    clear();
  });

  dropzone.addEventListener("drop", async function (event) {
    event.preventDefault();
    const fileEntries = await getAllFileEntries(event.dataTransfer.items);

    getTorrent(fileEntries);
    getMediaInfo(fileEntries);
    getScreenshots(fileEntries);
  });
}


main();
