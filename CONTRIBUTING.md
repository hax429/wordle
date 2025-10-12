# Contributing to Wordle Stats Web

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/yourusername/wordle-stats-web/issues)
2. If not, create a new issue with:
   - Clear title
   - Detailed description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Your environment (OS, Node version, browser)

### Suggesting Features

1. Check existing [Issues](https://github.com/yourusername/wordle-stats-web/issues) for similar suggestions
2. Create a new issue with:
   - Clear feature description
   - Use case and benefits
   - Proposed implementation (if you have ideas)

### Submitting Pull Requests

1. **Fork the repository**

2. **Clone your fork**
   ```bash
   git clone https://github.com/yourusername/wordle-stats-web.git
   cd wordle-stats-web
   ```

3. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make your changes**
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed

5. **Test your changes**
   ```bash
   npm install
   npm run setup
   npm start
   # Test thoroughly
   ```

6. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add feature: your feature description"
   ```

7. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **Create Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Describe your changes
   - Submit!

## Code Style

### JavaScript
- Use ES6+ features
- Use `const` and `let` (not `var`)
- Use async/await (not callbacks)
- Use meaningful variable names
- Add comments for complex logic

### File Organization
- Backend code in `server/`
- Frontend code in `public/`
- Keep files focused and modular
- One class per file when possible

### Naming Conventions
- Files: lowercase with hyphens (e.g., `database.js`)
- Classes: PascalCase (e.g., `WordleDatabase`)
- Functions: camelCase (e.g., `getAllTimeStats`)
- Constants: UPPER_SNAKE_CASE (e.g., `JWT_SECRET`)

## Development Setup

```bash
# Install dependencies
npm install

# Run setup
npm run setup

# Start development server (auto-reload)
npm run dev

# Make changes to server/* or public/*
# Test in browser at http://localhost:3000
```

## Testing Checklist

Before submitting PR, verify:
- [ ] Server starts without errors
- [ ] Can access public view
- [ ] Can login to admin console
- [ ] Can import data
- [ ] Statistics display correctly
- [ ] Charts render properly
- [ ] Mobile responsive (test on phone or use browser dev tools)
- [ ] No console errors (F12)
- [ ] No server errors in logs

## Areas for Contribution

We welcome contributions in:

### High Priority
- [ ] Automated testing suite
- [ ] Docker containerization
- [ ] PostgreSQL support
- [ ] Export to CSV/JSON
- [ ] User management (multiple admins)

### Medium Priority
- [ ] Real-time updates (WebSockets)
- [ ] Email notifications
- [ ] Mobile app (React Native)
- [ ] GraphQL API
- [ ] PWA support

### Low Priority
- [ ] Dark/light theme toggle
- [ ] Custom color schemes
- [ ] Additional chart types
- [ ] Internationalization (i18n)

## Questions?

- Open an [Issue](https://github.com/yourusername/wordle-stats-web/issues)
- Read the [README.md](README.md)
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for server setup

Thank you for contributing! 🎯


