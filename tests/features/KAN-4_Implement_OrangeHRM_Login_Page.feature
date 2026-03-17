@desktop @mobile @KAN-4
Feature: OrangeHRM Login Page
  As a system user I want to log into the OrangeHRM application using valid credentials so that I can securely access the HR management features available to my role

  Scenario Outline: Successful Login
    Given I am on the OrangeHRM login page
    When I enter username "<username>" and password "<password>"
    And I click on the login button
    Then I should be logged in and see the dashboard
    And I should see the welcome message with my name "<name>"

  Examples:
    | username | password | name     |
    | Admin    | admin123 | Admin    |
    | JohnDoe  | johndoe  | John Doe |

  Scenario Outline: Unsuccessful Login
    Given I am on the OrangeHRM login page
    When I enter username "<username>" and password "<password>"
    And I click on the login button
    Then I should see an error message with text "<error>"

  Examples:
    | username | password | error                         |
    | Admin    | wrong    | Invalid credentials           |
    | wrong    | admin123 | Invalid credentials           |
    |          | admin123 | Username cannot be empty       |
    | Admin    |          | Password cannot be empty        |