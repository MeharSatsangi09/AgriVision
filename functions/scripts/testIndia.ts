import { inIndia } from "../tools/india";

const inside: [string, number, number][] = [
  ["Nagpur", 21.15, 79.09], ["Delhi", 28.6, 77.2], ["Mumbai", 19.08, 72.88], ["Chennai", 13.08, 80.27],
  ["Kolkata", 22.57, 88.36], ["Guwahati", 26.14, 91.74], ["Srinagar", 34.08, 74.8], ["Kochi", 9.93, 76.27],
  ["Amritsar", 31.63, 74.87], ["Jaipur", 26.9, 75.8], ["Hyderabad", 17.4, 78.5], ["Ahmedabad", 23.0, 72.6],
  ["Bhubaneswar", 20.3, 85.8], ["Patna", 25.6, 85.1], ["Imphal", 24.8, 93.9], ["Shillong", 25.6, 91.9],
  ["Panaji", 15.5, 73.8], ["Mangalore", 12.9, 74.86], ["Kanyakumari", 8.09, 77.54], ["Surat", 21.17, 72.83],
  ["Bhavnagar", 21.76, 72.15], ["Rajkot", 22.3, 70.8], ["Bikaner", 28.0, 73.3], ["Leh", 34.17, 77.58],
  ["Itanagar", 27.1, 93.6], ["Gangtok", 27.3, 88.6], ["Dehradun", 30.3, 78.0], ["Bengaluru", 12.97, 77.59],
  ["Port Blair", 11.62, 92.73], ["Kavaratti", 10.57, 72.64], ["Agra", 27.23, 78.0], ["Center of India", 20.59, 78.96],
];
const outside: [string, number, number][] = [
  ["Arabian Sea (test click)", 13.74, 72.14], ["Arabian Sea off Mumbai", 19.92, 72.48], ["Bay of Bengal", 15.0, 87.0],
  ["Karachi", 24.86, 67.0], ["Colombo", 6.9, 79.9], ["Kathmandu", 27.7, 85.3], ["Dhaka", 23.8, 90.4],
  ["Indian Ocean", 3.0, 78.0], ["Tibet", 32.0, 88.0], ["NaN", NaN, 78],
];

let bad = 0;
for (const [n, lat, lng] of inside) if (!inIndia(lat, lng)) (bad++, console.log("WRONGLY REJECTED:", n));
for (const [n, lat, lng] of outside) if (inIndia(lat, lng)) (bad++, console.log("WRONGLY ACCEPTED:", n));
console.log(bad ? `${bad} failures` : `all ${inside.length + outside.length} location checks OK`);
process.exit(bad ? 1 : 0);
