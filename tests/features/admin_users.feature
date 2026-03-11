Feature: Admin - System Users management
  @ui @admin @users @regression @desktop
  Background:
    Given I am logged in

  Scenario: Open System Users list
    When I navigate to "Admin"
    And I open "User Management" > "Users"
    Then I should see the System Users list

  @ui @regression @desktop
  Scenario Outline: Search for a user
    When I navigate to "Admin"
    And I open "User Management" > "Users"
    And I search users by username "<username>"
    Then the user list should contain "<username>"

    Examples:
      | username        |
      | Admin           |
      | Jobinsam@6742   |