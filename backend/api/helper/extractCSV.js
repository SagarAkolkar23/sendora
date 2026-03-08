export function extractCsvHeaders(filePath) {
  return new Promise((resolve, reject) => {
    const headers = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("headers", (headerList) => {
        resolve(headerList.map((h) => h.trim()));
      })
      .on("error", reject);
  });
}
