Feature: API Health and Auth
  @api @smoke @regression
  Scenario: API base responds (health)
    Given the API base is reachable
    When I call the health endpoint
    Then the response status should be 2xx
    And if a JSON body contains "status" it should be "ok"

  @api @auth @regression
  Scenario Outline: Authentication via API
    Given API credentials from env are available
    When I POST to the login endpoint with "<username>" and "<password>"
    Then the API should return a success status

    Examples:
      | username | password  |
      | <env>    | <env>     |
      | invalid  | invalid   |