// Test file for IP whitelist functionality
import { isIPAllowedForEndpoint } from '../utils';

// Test cases for IP whitelist functionality
describe('IP Whitelist Functionality', () => {
  it('should allow all IPs when whitelist is empty', () => {
    expect(isIPAllowedForEndpoint('192.168.1.100', [])).toBe(true);
    expect(isIPAllowedForEndpoint('10.0.0.1', [])).toBe(true);
    expect(isIPAllowedForEndpoint('unknown', [])).toBe(true);
  });

  it('should allow IPs that are in the whitelist', () => {
    const whitelist = ['192.168.1.100', '10.0.0.1', '127.0.0.1'];
    expect(isIPAllowedForEndpoint('192.168.1.100', whitelist)).toBe(true);
    expect(isIPAllowedForEndpoint('10.0.0.1', whitelist)).toBe(true);
    expect(isIPAllowedForEndpoint('127.0.0.1', whitelist)).toBe(true);
  });

  it('should deny IPs that are not in the whitelist', () => {
    const whitelist = ['192.168.1.100', '10.0.0.1'];
    expect(isIPAllowedForEndpoint('192.168.1.101', whitelist)).toBe(false);
    expect(isIPAllowedForEndpoint('172.16.0.1', whitelist)).toBe(false);
  });

  it('should handle localhost variations correctly', () => {
    const whitelist = ['127.0.0.1'];
    expect(isIPAllowedForEndpoint('::1', whitelist)).toBe(true);
    expect(isIPAllowedForEndpoint('localhost', whitelist)).toBe(true);
    
    const ipv6Whitelist = ['::1'];
    expect(isIPAllowedForEndpoint('127.0.0.1', ipv6Whitelist)).toBe(true);
    
    const localhostWhitelist = ['localhost'];
    expect(isIPAllowedForEndpoint('127.0.0.1', localhostWhitelist)).toBe(true);
  });

  it('should handle unknown IP correctly', () => {
    const whitelist = ['192.168.1.100'];
    expect(isIPAllowedForEndpoint('unknown', whitelist)).toBe(false);
    expect(isIPAllowedForEndpoint('', whitelist)).toBe(false);
  });

  it('should handle whitespace in IPs', () => {
    const whitelist = [' 192.168.1.100 ', '10.0.0.1'];
    expect(isIPAllowedForEndpoint(' 192.168.1.100 ', whitelist)).toBe(true);
    expect(isIPAllowedForEndpoint('192.168.1.100', whitelist)).toBe(true);
  });
});
