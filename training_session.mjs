const ActivityType = {
    RUNNING: 'RUNNING',
    STRENGTH_CONDITIONING: 'STRENGTH_CONDITIONING',
    OTHER: 'OTHER'
  };
  
  class TrainingSession {
      constructor(user_id, session_id, activity_name, timestamp_local, activity_type, duration_in_seconds, average_heart_rate_in_bpm, average_speed_km_h, average_pace_min_per_km, active_calories, distance_meters_total, max_heart_rate_in_bpm, max_pace_min_per_km, max_speed_km_h, elevation_gain_meters_total, elevation_gain_meters, speed_km_h, heart_rate, temperature, distance_meters, laps_data) {
          this.user_id = user_id;
          this.session_id = session_id;
          this.activity_name = activity_name;
          this.timestamp_local_seconds = timestamp_local;
          this.timestamp_local = this.format_timestamp(timestamp_local);
          this.activity_type = activity_type;
          this.duration_in_seconds = duration_in_seconds;
          this.duration = this.seconds_to_hh_mm_ss(duration_in_seconds),
          this.points_gained = this.calculate_points(distance_meters_total);
          this.average_heart_rate_in_bpm = average_heart_rate_in_bpm;
          this.average_speed_km_h = this.round(average_speed_km_h,2);
          this.average_pace_min_per_km = this.round(average_pace_min_per_km,2);
          this.active_calories = active_calories;
          this.distance_meters_total = this.round(distance_meters_total,0);
          this.max_heart_rate_in_bpm = max_heart_rate_in_bpm;
          this.max_pace_min_per_km = this.round(max_pace_min_per_km,2);
          this.max_speed_km_h = this.round(max_speed_km_h,2);
          this.elevation_gain_meters_total = this.round(elevation_gain_meters_total,0);
          this.elevation_gain_meters = this.roundDictionaryValues(elevation_gain_meters, 0);
          this.speed_km_h = this.roundDictionaryValues(speed_km_h, 2);
          this.distance_meters = this.roundDictionaryValues(distance_meters, 0);
          this.heart_rate = heart_rate;
          this.temperature = temperature;
          this.laps_data = laps_data;
      }
  
      round(number, decimal_places) {
          const factor = Math.pow(10, decimal_places);
          return Math.round(number * factor) / factor;
      }
  
      roundDictionaryValues(dictionary, decimal_places) {
          Object.keys(dictionary).forEach(key => {
              dictionary[key] = this.round(dictionary[key], decimal_places);
          });
          return dictionary;
      }
  
      calculate_points(distance_meters_total) {
        let points = 0;
          if (this.activity_type === ActivityType.RUNNING) {
            points = this.round(distance_meters_total/100, 0);
          }
        return {
              endurance: points,
              total: points
          };
      }
  
      prepare_event_bridge_params() {
          const params = {
              Entries: [
                  {
                      Source: 'com.mycompany.myapp.activities',
                      DetailType: 'activity_processed',
                      Detail: JSON.stringify({
                          user_id: this.user_id,
                          timestamp_local: this.timestamp_local_seconds,
                          session_id: this.session_id,
                          activity_type: this.activity_type,
                          distance_in_meters: this.distance_meters_total,
                          points_gained: JSON.stringify(this.points_gained)
                      }),
                      EventBusName: 'default',
                  },
              ],
          };
          return params;
      }
  
      prepare_dynamo_db_log_params(table_name) {
          const params = {
              TableName: table_name, 
              Item: {
                  user_id: this.user_id,
                  session_id: this.session_id.toString(),
                  activity_name: this.activity_name,
                  duration: this.duration,
                  timestamp_local: this.timestamp_local, 
                  points_gained: JSON.stringify(this.points_gained),
                  display_frontend_notification: true,
                  activity_type: this.activity_type,
                  average_heart_rate_in_bpm: this.average_heart_rate_in_bpm,
                  average_speed_km_h: this.average_speed_km_h, 
                  average_pace_min_per_km: this.average_pace_min_per_km,
                  active_calories: this.active_calories, 
                  distance_meters_total: this.distance_meters_total, 
                  max_heart_rate_in_bpm: this.max_heart_rate_in_bpm,
                  max_pace_min_per_km: this.max_pace_min_per_km, 
                  max_speed_km_h: this.max_speed_km_h, 
                  elevation_gain_meters_total: this.elevation_gain_meters_total, 
                  elevation_gain_meters: JSON.stringify(this.elevation_gain_meters), 
                  speed_km_h: JSON.stringify(this.speed_km_h),
                  heart_rate: JSON.stringify(this.heart_rate),
                  temperature: JSON.stringify(this.temperature),
                  distance_meters: JSON.stringify(this.distance_meters), 
                  laps_data: JSON.stringify(this.laps_data)
              },
          };
          return params;
      }

      format_timestamp(unix_timestamp) {
        const date = new Date(unix_timestamp * 1000);
        
        const year = date.getUTCFullYear();
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = date.getUTCDate().toString().padStart(2, '0');
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        const seconds = date.getUTCSeconds().toString().padStart(2, '0');
        
        const formated_timestamp = `${year}-${month}-${day}-${hours}:${minutes}:${seconds}`;
        return formated_timestamp;
    }

    seconds_to_hh_mm_ss(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remaining_seconds = seconds % 60;
    
        const hours_str = hours.toString().padStart(2, '0');
        const minutes_str = minutes.toString().padStart(2, '0');
        const seconds_str = remaining_seconds.toString().padStart(2, '0');
    
        return `${hours_str}:${minutes_str}:${seconds_str}`;
    }
    
  
      prepare_dynamo_db_aggregate_params(table_name) {
          const { year, week } = this.get_year_week_from_timestamp(this.timestamp_local_seconds);

          const week_string = week < 10 ? `0${week}` : `${week}`;
          const user_activity_key = `${this.user_id}#${this.activity_type}`;
          const year_week_key = `${year}#${week_string}`;
        console.log("Year-Week Key: ", year_week_key);
          const params = {
              TableName: table_name,
              Key: {
                  'user_id#activity_type': user_activity_key, 
                  'year#week': year_week_key, 
              },
              UpdateExpression: 'ADD km :km, hours :hours',
              ExpressionAttributeValues: {
                  ':km': this.round(this.distance_meters_total / 1000,2), 
                  ':hours': this.round(this.duration_in_seconds / 3600, 2), 
              },
          };
      
          return params;
      }
  
      get_year_week_from_timestamp(timestamp) {
        const date = new Date(timestamp * 1000); 
        date.setHours(0, 0, 0, 0); 
    
        const dayOfWeek = date.getDay();
        date.setDate(date.getDate() - dayOfWeek + 4);
    
        const yearStart = new Date(date.getFullYear(), 0, 1);

        if (date < yearStart) {
            yearStart.setFullYear(yearStart.getFullYear() - 1);
        }
        yearStart.setDate(yearStart.getDate() - yearStart.getDay() + 4);
    
        const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);

        return { year: date.getFullYear(), week };
    }
  }
  
  
  export class TrainingSessionGarmin extends TrainingSession {
      constructor(data, user_id) {
          const session_id = data.activityId || 0;
          const activity_name = data.summary.activityName || null;
          const timestamp_local = TrainingSessionGarmin.convert_to_local_time(data.summary.startTimeInSeconds || 0, data.summary.startTimeOffsetInSeconds || 0);
          const activity_type = TrainingSessionGarmin.convert_to_activity_type(data.summary.activityType)|| null;
          const duration_in_seconds = data.summary.durationInSeconds || 0;
          const average_heart_rate_in_bpm = data.summary.averageHeartRateInBeatsPerMinute || 0;
          const average_speed_km_h = TrainingSessionGarmin.convert_speed(data.summary.averageSpeedInMetersPerSecond || 0);
          const average_pace_min_per_km = data.summary.averagePaceInMinutesPerKilometer || 0;
          const active_calories = data.summary.activeKilocalories || 0;
          const distance_meters_total = data.summary.distanceInMeters || 0;
          const max_heart_rate_in_bpm = data.summary.maxHeartRateInBeatsPerMinute || 0;
          const max_pace_min_per_km = data.summary.maxPaceInMinutesPerKilometer || 0;
          const max_speed_km_h = TrainingSessionGarmin.convert_speed(data.summary.maxSpeedInMetersPerSecond || 0);
          const elevation_gain_meters_total = data.summary.totalElevationGainInMeters || 0;
  
          let elevation_gain_meters = {};
          let speed_km_h = {};
          let heart_rate = {};
          let temperature = {};
          let distance_meters = {};
          let laps_data = data.laps ? data.laps.map(lap => lap.startTimeInSeconds) : [];
  
          if (data.samples) {
              data.samples.forEach(sample => {
                  const timer_duration_seconds = sample.timerDurationInSeconds || 0;
                  elevation_gain_meters[timer_duration_seconds] = sample.elevationInMeters || 0;
                  speed_km_h[timer_duration_seconds] = TrainingSessionGarmin.convert_speed(sample.speedMetersPerSecond || 0);
                  heart_rate[timer_duration_seconds] = sample.heartRate || 0;
                  temperature[timer_duration_seconds] = sample.airTemperatureCelcius || 0;
                  distance_meters[timer_duration_seconds] = sample.totalDistanceInMeters || 0;
              });
          }
  
          super(user_id, session_id, activity_name, timestamp_local, activity_type, duration_in_seconds, average_heart_rate_in_bpm, average_speed_km_h, average_pace_min_per_km, active_calories, distance_meters_total, max_heart_rate_in_bpm, max_pace_min_per_km, max_speed_km_h, elevation_gain_meters_total, elevation_gain_meters, speed_km_h, heart_rate, temperature, distance_meters, laps_data);
      }
  
      static convert_to_local_time(utc_seconds, offset_in_seconds) {
          return (utc_seconds + offset_in_seconds);
      }
  
      static convert_speed(speed_meters_per_second) {
          return speed_meters_per_second * 3.6;
      }
  
     
      static convert_to_activity_type(garmin_activity_type) {
    
      const running_activities = [
        'RUNNING', 'INDOOR_RUNNING', 'OBSTACLE_RUN', 'STREET_RUNNING',
        'TRACK_RUNNING', 'TRAIL_RUNNING', 'TREADMILL_RUNNING',
        'ULTRA_RUN', 'VIRTUAL_RUN'
      ];
    

      const strength_conditioning_activities = [
        'FITNESS_EQUIPMENT', 'BOULDERING', 'ELLIPTICAL', 'INDOOR_CARDIO',
        'HIIT', 'INDOOR_CLIMBING', 'INDOOR_ROWING', 'PILATES',
        'STAIR_CLIMBING'
      ];
    

      if (running_activities.includes(garmin_activity_type)) {
        return ActivityType.RUNNING;
      } else if (strength_conditioning_activities.includes(garmin_activity_type)) {
        return ActivityType.STRENGTH_CONDITIONING;
      } else {
        return ActivityType.OTHER;
      }
    }
  }  