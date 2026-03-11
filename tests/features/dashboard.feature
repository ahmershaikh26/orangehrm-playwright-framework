Feature: Dashboard and Quick Launch widgets
  @ui @dashboard @smoke @desktop @mobile
  Scenario: Dashboard loads and widgets are visible
    Given I am logged in
    When I navigate to the dashboard
    Then the dashboard should be visible
    And the "Time at Work" widget should be visible
    And the "Quick Launch" widget should be visible