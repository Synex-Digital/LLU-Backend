-   Home

    ### http://localhost:8080/api/facilitator/home?page=1&limit=5

    method: GET  
    query: page=1 limit=5  
    Authorization: Bearer Token

-   Add Facility

    ### http://localhost:8080/api/facilitator/2/add_facility

    method: POST  
    Authorization: Bearer token  
    params: facility_id = 2  
    Body:

    ```js
    {
        "hourly_rate": 100.45,
        "name": "Abahoni football field",
        "latitude": 40.712776,
        "longitude": -74.005974,
        "capacity": 30,
        "established_in": 1980,
        "available_hours": {
            "saturday": "10:00 AM - 11:00 AM",
            "sunday": "10:00 AM - 11:00 AM",
            "monday": "10:00 AM - 11:00 AM",
            "tuesday": "10:00 AM - 11:00 AM",
            "wednesday": "10:00 AM - 11:00 AM",
            "thursday": "10:00 AM - 11:00 AM",
            "friday": "Not available"
        }
    }
    ```

-   Session Details

    ### http://localhost:8080/api/facilitator/sessions/1

    method: GET
    params: session_id = 1
    Authorization: Bearer token
