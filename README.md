# Issue Navigator

Issue Navigator is a Chrome extension designed to enhance your GitHub experience by adding keybinds for seamless navigation between issues and pull requests. This tool is particularly useful for maintainers and contributors who need to skim through issues efficiently.

## Features

- **Keybind Navigation**: Easily navigate between issues and pull requests using keyboard shortcuts.
- **Advanced Filtering**:
  - Restrict results to the current page type (issues or pull requests) or include all types.
  - Filter by open or closed state.
  - Sort by creation or update date, as well as ascending or descending order, which are automatically fetched when changed on the issue pages.
- **GitHub API Integration**: Fully utilizes the GitHub API to fetch and display data.
- **Local Data Storage**: Uses Chrome storage to cache data locally, ensuring fast performance and data safety.
- **GitHub Authentication**: Authenticate with GitHub for increased API rate limits, allowing for more extensive usage.

## Why Use Issue Navigator?

- **Efficiency**: Quickly skim through newly posted issues or pull requests without manually navigating GitHub.
- **Customization**: Tailor the navigation experience with advanced filtering options.
- **Lightweight**: Even without GitHub authentication, the extension supports light usage scenarios, such as scanning the first page or two of issues.
- **Secure**: All data is stored locally, ensuring privacy and security.

## Installation for development

1. Clone the repository
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top-right corner.
4. Click "Load unpacked" and select the `IssueNavigator` folder you cloned.
5. The extension is now installed and ready for development!

## Usage

1. Navigate to a GitHub repository's issues or pull requests page.
2. Use the default keybinds (right and left arrows) or set your own keybinds in the extension to navigate between issues or pull requests.
3. Customize filtering options to suit your workflow (for example, easily skim through all open, newly created issues).
4. Authenticate with GitHub (optional) for extended API usage.

## Future Goals

- **Label Filtering**: Add support for filtering issues by labels, assignees, etc.
- **Improved API Handling**: Implement a new method to handle initializing issues that are far from the start of the board (e.g., 10,000 issues away) for better use in larger projects.
- **Assigned Issues**: Add support for assigned issues page for authenticated users.
- **Additional Features**: Continuously improve the extension with new features and optimizations.

## Contributing

Contributions are welcome! If you have ideas, suggestions, or bug reports, feel free to open an issue or submit a pull request.

## License

This project is open source and available under the [MIT License](LICENSE).
