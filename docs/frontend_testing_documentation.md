# Splitter Frontend Testing Documentation

## 1. Overview of Frontend Testing Strategy
The frontend testing architecture of the Splitter project is structured to guarantee the stability, reliability, and correctness of user interfaces. The testing framework uses:

- **Jest**
- **React Testing Library**
- **DOM interaction simulation**
- **Mocked API requests**

Frontend testing ensures that:
- UI components behave correctly.
- Pages render properly.
- API calls are structured correctly.
- Form validation prevents invalid data.
- Authentication flows work properly.

These localized frontend tests directly complement the backend integration architecture by guaranteeing that the client-side user experience operates nominally without executing actual local network payload processing.

---

## Testing Tools and Frameworks
The project relies on the following testing tools and frameworks:

**Jest**  
Primary JavaScript testing framework used to execute automated test suites.

**React Testing Library**  
Used to simulate user interactions with components and verify DOM behavior.

**JSDOM**  
Provides a browser-like environment for executing React tests inside Node.js.

**Jest Mocking**  
Used to mock API calls, authentication tokens, and network responses so tests can run without a live backend.

---

## 2. Test Suite Structure
The testing structure in the project is organized into robust modular categories mapping directly onto specific operational behaviors.

```
__tests__/
├── components/
│   ├── PostCard.test.jsx
│   ├── PostComposer.test.jsx
│   └── ReplyBox.test.jsx
│
├── pages/
│   ├── LoginPage.test.jsx
│   ├── RegisterPage.test.jsx
│   └── FeedPage.test.jsx
│
├── lib/
│   ├── api.test.ts
│   └── apiAuth.test.ts
│
├── validation/
│   ├── loginValidation.test.jsx
│   └── registerValidation.test.jsx
│
└── security/
    └── authFlow.test.jsx
```

The project currently contains 11 Jest test suites comprising 38 individual tests, covering core UI components, page interactions, API logic, validation mechanisms, and authentication flows.

These test suites collectively validate UI behavior, API interactions, and authentication flows.

---

## 3. Component Unit Testing
UI components are tested in isolation using React Testing Library to prove granular control capabilities.

Tested components include:
- `PostCard`
- `PostComposer`
- `ReplyBox`

These tests explicitly validate:
- component rendering
- button interactions
- callback execution
- UI state changes

**Example Test Case:**
- **Component:** PostCard
- **Test Case:** "Renders post content correctly"
- **Expected Result:** DOM contains post content and action buttons.

**Example Output Snippet:**
```
PASS  __tests__/components/PostCard.test.jsx
```

---

## 4. Page Interaction Testing
Full page components are dynamically tested using simulated DOM interactions matching actual user operations.

Pages tested include:
- `LoginPage`
- `RegisterPage`
- `FeedPage`

These tests explicitly validate:
- form inputs
- user interaction flows
- navigation callbacks
- UI state transitions

**Example Test Case:**
- **Test Case:** Successful Login Flow
- **Steps:**
  1. Enter username and password
  2. Click login button
  3. Mock API returns token
- **Expected Result:** User session initialized.

**Example Output Snippet:**
```
PASS  __tests__/pages/LoginPage.test.jsx
```

---

## 5. API Interaction Testing
API calls are tested strictly by mocking `fetch` logic allowing internal payloads to be mapped safely against the correct endpoints.

External API calls are mocked using Jest so that frontend tests can validate request structure and response handling without requiring a running backend server.

This ensures tests remain deterministic and independent from network conditions.

Files tested:
- `lib/api.ts`
- `lib/apiAuth.ts`

Validated scenarios:
- `register()`
- `login()`
- `getCurrentUser()`
- `createPost()`

**Example Test Case:**
- **Test Case:** Register API Call
- **Expected Result:** POST request sent to `http://localhost:8000/api/v1/auth/register` with JSON payload.

**Example Output Snippet:**
```
PASS  __tests__/lib/apiAuth.test.ts
```

---

## 6. Validation Testing
Client-side validation rules are scrutinized to block flawed requests preceding the database processing.

Files tested:
- `loginValidation.test.jsx`
- `registerValidation.test.jsx`

Validated cases include:
- empty username
- empty password
- invalid email format
- missing required fields

**Example Negative Case:**
- **Test Case:** Register Without Username
- **Expected Result:** Form validation prevents submission.

**Example Output Snippet:**
```
PASS  __tests__/validation/registerValidation.test.jsx
```

---

## 7. Security / Authentication Flow Testing
Authentication logic and local-storage bindings are handled extensively across protection systems to maintain strict visibility parameters.

File tested:
- `authFlow.test.jsx`

Validated flows:
- successful login
- failed login
- token handling
- protected request headers

**Example Output Snippet:**
```
PASS  __tests__/security/authFlow.test.jsx
```

---

## 8. Negative Test Cases
Deliberate negative test implementations explicitly enforce boundary failure processing behaviors.

| Test Case | Scenario | Expected Result |
|-----------|----------|----------------|
| Invalid Login | Wrong password | Error message displayed |
| Empty Login Fields | Missing username/password | Validation prevents request |
| Invalid Register Input | Missing required fields | Form validation triggered |
| Unauthorized API Call | Missing token | Request rejected |
| Failed Auth Request | Backend returns error | Error handled gracefully |

---

## 9. Test Execution Results
Execution summaries evaluate test engine successes resolving configurations properly without timeout latency issues.

```
Test Suites: 11 passed, 11 total
Tests:       38 passed, 38 total
Snapshots:   0 total
Time:        ~2.991 s
Ran all test suites.
```

---

## Running Frontend Tests
Tests can be executed using the following command:

npm test -- --watchAll=false

To generate coverage reports:

npm test -- --coverage --watchAll=false

This section documents how developers can reproduce the frontend test results locally.

---

## 10. Test Coverage Metrics
Coverage metric analysis maps how comprehensive test instructions overlay into original codebase.

| File | Coverage (% Lines) |
|------|--------------------|
| `components/pages` | ~61.16% |
| `components/ui` | ~23.8% |
| `All files` | ~21.63% |

Lower coverage in certain files occurs because some cryptographic utility functions and API helper modules contain complex logic that is not directly triggered by UI interaction tests.

These modules are typically validated through backend integration testing rather than frontend UI simulations.

Frontend tests primarily focus on verifying rendering behavior, user interaction flows, and correct API request formation.

---

## 11. Conclusion
The frontend testing strategy is implemented via:
- 11 Jest test suites
- 38 automated tests
- Component testing
- Page interaction testing
- API testing
- Validation testing
- Authentication flow testing

This integration effectively deploys a robust automated testing functional layer across the Splitter React structures ensuring application reliability and definitively preventing catastrophic regressions inside complex nested codebase routines!
