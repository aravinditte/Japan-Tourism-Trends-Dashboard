# 🇯🇵 Japan Tourism Trends Dashboard

## Overview
A clean, fast, single-page web application that displays official data on international tourist arrivals to Japan, allowing users to view trends for specific countries.

## Features
- **Interactive Line Chart**: Displays visitor trends from 2018-2024
- **Country Selection**: Choose from top 5 visitor countries (South Korea, China, Taiwan, USA, Hong Kong)
- **Dynamic Statistics**: Shows latest year data, pre-COVID peak, and recovery rates
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Real Data**: Based on official JNTO (Japan National Tourism Organization) statistics

## Data Source
All data is sourced from the official Japan National Tourism Organization (JNTO) statistics, covering international visitor arrivals from 2018-2024.

## Technologies Used
- **HTML5**: Semantic structure
- **CSS3**: Modern styling with gradients and responsive design
- **JavaScript (ES6+)**: Interactive functionality and data management
- **Chart.js**: Beautiful, responsive charts
- **JSON**: Data format for tourism statistics

## Installation & Usage

### Option 1: GitHub Pages (Recommended)
1. Visit the live demo: [Japan Tourism Trends Dashboard](https://aravinditte.github.io/Japan-Tourism-Trends-Dashboard/)

### Option 2: Local Development
1. Clone this repository:
   ```bash
   git clone https://github.com/aravinditte/Japan-Tourism-Trends-Dashboard.git
   cd Japan-Tourism-Trends-Dashboard
   ```

2. Open `index.html` in your web browser
   - For best results, serve via a local web server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js (if you have live-server installed)
   live-server
   ```

3. Navigate to `http://localhost:8000` in your browser

## File Structure
```
.
├── index.html          # Main HTML file
├── style.css           # Responsive CSS styling
├── script.js           # JavaScript functionality
├── tourism_data.json   # Official JNTO tourism data
├── README.md          # This file
└── LICENSE            # MIT License
```

## Key Statistics (2024)
- **South Korea**: 8.8M visitors (158% recovery vs 2019)
- **China**: 7.0M visitors (73% recovery vs 2019)
- **Taiwan**: 6.0M visitors (124% recovery vs 2019)
- **USA**: 2.7M visitors (158% recovery vs 2019)
- **Hong Kong**: 2.7M visitors (117% recovery vs 2019)

## Future Enhancements
- Multi-country comparison charts
- Date range selector
- Additional datasets (spending, prefectures visited)
- Different chart types (pie charts, bar charts)
- Export functionality
- More countries and regions

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Data Attribution
Data provided by the Japan National Tourism Organization (JNTO)
- Website: https://www.tourism.jp/en/
- Statistics: https://statistics.jnto.go.jp/en/

## Development Notes
This project was built as an MVP (Minimum Viable Product) focusing on:
- Clean, professional design
- Fast loading performance
- Accurate, official data
- Responsive user experience
- Modern web standards