Feature: Add User flow
  @ui @admin @users @regression @desktop
  Background:
    Given I am logged in
    And I navigate to "Admin"
    And I open "User Management" > "Users"

  Scenario Outline: Add a new system user
    When I click "Add"
    And I select user role "<userRole>"
    And I enter employee name "<employeeName>"
    And I enter username "<username>"
    And I set status "<status>"
    And I set password "<password>"
    And I save the user
    Then the newly added user "<username>" should appear in the users list

    Examples:
      | userRole | employeeName      | username        | status  | password     |
      | ESS      | Jobin Sam         | jobinsam_6742   | Enabled | Passw0rd!    |
      | Admin    | firstNameTest l   | newadmin_user   | Enabled | AdminPass123 |