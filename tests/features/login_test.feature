@Login
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

  @TC_2 @ui @ui-elements @desktop @mobile
  Scenario: Login page should have required fields
    Given I am on the login page
    Then I should see a username field
    And I should see a password field
    And I should see a login button

  @TC_3 @ui @smoke @regression @desktop @mobile
  Scenario Outline: Successful login with valid credentials
    Given I am on the login page
    When I login with "<username>" and "<password>"
    Then I should be redirected to the dashboard
    And I should see a welcome message

    Examples:
      | username | password  |
      | Admin    | admin123  |

  @TC_4 @ui @ui-elements @desktop @mobile
  Scenario: Login page should have required fields
    Given I am on the login page
    Then I should see a username field
    And I should see a password field
    And I should see a login button

  @TC_5 @ui @smoke @regression @desktop @mobile
  Scenario Outline: Successful login with valid credentials
    Given I am on the login page
    When I login with "<username>" and "<password>"
    Then I should be redirected to the dashboard
    And I should see a welcome message

    Examples:
      | username | password  |
      | Admin    | admin123  |

  @TC_6 @ui @ui-elements @desktop @mobile
  Scenario: Login page should have required fields
    Given I am on the login page
    Then I should see a username field
    And I should see a password field
    And I should see a login button