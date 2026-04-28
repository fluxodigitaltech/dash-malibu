// src/utils/csv.ts
import Papa from 'papaparse';

export const parseCsvFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', ';', '\t', '|'],
      dynamicTyping: false, 
      complete: (results: Papa.ParseResult<any>) => {
        if (results.errors.length) {
          reject(new Error(results.errors[0].message));
        } else {
          resolve(results.data);
        }
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
};