const fs = require('fs');
const data = JSON.parse(fs.readFileSync('static/benchmark_lb.json'));
const allModels = data.models;
const allBenchmarks = Object.values(data.benchmarks);
const getAxisAvg = (k) => {
  let sum = 0, count = 0;
  for (const m of allModels) {
    if (m.scores[k] != null) { sum += m.scores[k]; count++; }
  }
  return count ? sum / count : 0;
};
const cats = allBenchmarks.filter(b => !b.parentKey).map(b => b.key);
console.log("Category Averages:");
cats.forEach(k => console.log(`${k}: ${getAxisAvg(k).toFixed(2)}`));
