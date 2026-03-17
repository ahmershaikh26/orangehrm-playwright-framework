@desktop @mobile @KAN-4
Feature: OrangeHRM Login Page
  As a system user I want to log into the OrangeHRM application using valid credentials so that I can securely access the HR management features available to my role

  Scenario Outline: Successful Login with Valid Credentials
    Given I am on the OrangeHRM login page
    When I enter "<username>" as username
    And I enter "<password>" as password
    And I click on the login button
    Then I should be logged in to the OrangeHRM application
    And I should see the dashboard page

    Examples:
      | username | password |
      | Admin    | admin123 |
      | user1    | pass123  |

  Scenario Outline: Unsuccessful Login with Invalid Credentials
    Given I am on the OrangeHRM login page
    When I enter "<username>" as username
    And I enter "<password>" as password
    And I click on the login button
    Then I should see an error message
    And I should not be logged in to the OrangeHRM application

    Examples:
      | username | password |
      | invalid  | invalid  |
      |          |           |
      | user1    | wrongpass |