import 'reflect-metadata';
import { supportedRestaurantSortKeys, TRestaurantSortKey } from '@interfaces/restaurantFilters.interface';
import { supportedCurrencies } from '@utils/currency';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';

const trimText = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim() : value);

const splitByComma = ({ value }: TransformFnParams) =>
  typeof value === 'string'
    ? value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    : value;

export class CreateRestaurantDto {
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  public name: string;

  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  public address: string;

  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  public city: string;

  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  public country: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  public cuisines: string[] = [];

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  public lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  public lng?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  public costForTwo?: number;

  @IsIn(supportedCurrencies)
  public currency: string = 'INR';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  public avgRating?: number;
}

class RestaurantFiltersDto {
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  public name?: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  public city?: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  public country?: string;

  @IsOptional()
  @Transform(splitByComma)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  public cuisines?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  public minRating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  public maxCostForTwo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  public lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  public lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  public maxDistanceKm?: number;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  public place?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  public limit: number = 20;
}

export class ListRestaurantsDto extends RestaurantFiltersDto {
  @IsIn(supportedRestaurantSortKeys)
  public sort: TRestaurantSortKey = 'relevance';
}

export class SearchRestaurantsDto extends RestaurantFiltersDto {
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(200)
  public q?: string;

  @IsOptional()
  @IsIn(supportedRestaurantSortKeys)
  public sort?: TRestaurantSortKey;
}

export class ParsedRestaurantFiltersDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public city?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  public cuisines?: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public dish?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public dishCuisine?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  public place?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  public minRating?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  public maxCostForTwo?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  public lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  public lng?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  public maxDistanceKm?: number;

  @IsOptional()
  @IsIn(supportedRestaurantSortKeys)
  public sort?: TRestaurantSortKey;
}
