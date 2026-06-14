const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = {
  entry: {
    background: './src/background/background.ts',
    offscreen: './src/offscreen/offscreen.ts',
    sidepanel: './src/sidepanel/sidepanel.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/sidepanel/sidepanel.html', to: 'sidepanel.html' },
        { from: 'src/offscreen/offscreen.html', to: 'offscreen.html' },
        { from: 'src/assets', to: 'assets' },
        { 
          from: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 
          to: 'pdf.worker.min.js' 
        },
      ],
    }),
  ],
  devtool: 'cheap-source-map',
  optimization: {
    minimize: false, // Keep readable for debugging
  },
};

