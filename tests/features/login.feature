Feature: Login Functionality
  @TC_1 @ui @smoke @regression @desktop @mobile
  Scenario Outline: Successful login with valid credentials
    Given I am on the login page
    When I login with "<username>" and "<password>"
    Then I should be redirected to the dashboard
    And I should see a welcome message

    Examples:
      | username | password  |
      | Admin    | admin123  |

  @TC_2 @ui @negative @regression @desktop
  Scenario: Unsuccessful login with invalid credentials
    Given I am on the login page
    When I login with "<username>" and "<password>"
    Then I should see an error message indicating invalid credentials

     Examples:
      | username | password   |
      | Admin    | admin1234  |

  @TC_3 @ui @ui-elements @desktop @mobile
  Scenario: Login page should have required fields
    Given I am on the login page
    Then I should see a username field
    And I should see a password field
    And I should see a login button

  @TC_4 @ui @desktop @mobile
  Scenario: Password recovery link is available
    Given I am on the login page
    Then I should see a password recovery link

  @TC_5 @ui @logout @desktop
  Scenario: User should be able to log out
    Given I am on the login page
    When I login with "<username>" and "<password>"
    Then I should be redirected to the dashboard
    When I click on the logout button
    Then I should be redirected to the login page
    And I should see a message indicating successful logout

     Examples:
      | username | password  |
      | Admin    | admin123  |